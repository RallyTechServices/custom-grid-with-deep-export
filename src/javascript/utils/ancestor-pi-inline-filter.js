Ext.define('Utils.AncestorPiInlineFilterPlugin', {
    alias: 'plugin.UtilsAncestorPiInlineFilterPlugin',
    mixins: ['Ext.AbstractPlugin'],
    extend: 'Ext.Component',
    portfolioItemTypes: [],
    modelName: undefined,
    
    init: function(cmp) {
        var filterFactoryOverrides = {};
        var additionalFields = []
        _.each(this.portfolioItemTypes, function(piType) {
            var typePath = piType.get('TypePath');
            var displayName = 'Portfolio Item / ' + piType.get('Name');
            filterFactoryOverrides[typePath] = {
                   xtype: 'ancestorpisearchfield',
                   portfolioItemType: typePath, // The artifact type to search for
                   portfolioItemTypes: this.portfolioItemTypes,  // List of portfolio item types
                   artifactTypeName: this.modelName, // The artifact type we are filtering
                   emptyText: 'Search ' + displayName + 's...'
            };
            additionalFields.push({
              name: typePath,
              displayName: displayName
            })
       }, this);
       
       // Add the additional fields to the quick filter config
        _.merge(cmp.addQuickFilterConfig, {
                additionalFields: additionalFields
        }, function(a,b) {
            if (_.isArray(a)) {
                return a.concat(b)
            }
        });
        
        // Add the corresponding items to the FilterFieldFactory
        Ext.override(Rally.ui.inlinefilter.FilterFieldFactory, filterFactoryOverrides);
    }
});
/*
Ext.define('Utils.AncestorPiInlineFilter', {
   override: 'Rally.ui.inlinefilter.FilterFieldFactory',
   
   PortfolioItem_Epic: {
       xtype: 'ancestorpisearchfield',
       model: 'PorfolioItem/Epic'
   }
});
*/

Ext.define('Utils.AncestorPiSearchField', {
    alias: 'widget.ancestorpisearchfield',
    extend: 'Rally.ui.inlinefilter.ArtifactSearchField',
    parentField: 'PortfolioItem.Parent.',
   
    artifactTypeName: undefined, // The name of the model that will be filtered
    portfolioItemTypes: [],
   
    getFilter: function() {
        var value = this.lastValue;
        if (!Ext.isEmpty(value)) {
            var filters = [],
                models = this.model.getArtifactComponentModels();
    
            var onlyNumbers = new RegExp('^(\\d+)$');
            if (onlyNumbers.test(value) && this._isValidField(this.model, ['FormattedID'])) {
                filters.push({
                    property: 'FormattedID',
                    operator: 'contains',
                    value: value
                });
            }
    
            _.each(models, function(model) {
                var prefixPlusNumbers = new RegExp(Ext.String.format('^({0}\\d+)$', model.idPrefix), 'i');
                if (prefixPlusNumbers.test(value) && model.isArtifact()) {
                    filters.push(
                        Rally.data.wsapi.Filter.and([
                            {
                                property: 'TypeDefOid',
                                operator: '=',
                                value: model.typeDefOid
                            },
                            {
                                property: 'FormattedID',
                                operator: 'contains',
                                value: value
                            }
                        ])
                    );
                } else if (prefixPlusNumbers.test(value) && this._isValidField(model, ['FormattedID'])) {
                    filters.push({
                        property: 'FormattedID',
                        operator: 'contains',
                        value: value
                    });
                }
            }, this);
    
            if (this._isValidField(this.model, ['Name'])) {
                filters.push({
                    property: 'Name',
                    operator: 'contains',
                    value: value
                });
            }
    
            if (this._isValidField(this.model, ['Description'])) {
                filters.push({
                    property: 'Description',
                    operator: 'contains',
                    value: value
                });
            }
    
            return Rally.data.wsapi.Filter.or(this.setParentFilterProperty(filters));
        }
    },
    
    setParentFilterProperty: function(filters) {
        var propertyPrefix = this.propertyPrefix();
        _.forEach(filters, function(filter) {
           filter.property = propertyPrefix + '.' + filter.property; 
        }, this);
        return filters;
    },
    
    propertyPrefix: function() {
       var property;
       switch(this.artifactTypeName) {
           case 'HierarchicalRequirement':
               property = 'PortfolioItem'
               break;
            case 'Defect':
                property = 'Requirement';
                break;
            case 'Task':
                // Fall through
            case 'TestCase':
                property = 'WorkProduct'
                break;
       }
       
       if ( property ) {
           _.forEach(this.portfolioItemTypes, function(piType) {
               if ( piType.get('TypePath') == this.portfolioItemType ) {
                   return false;
               } else {
                   property = property + '.Parent'
               }
           }, this);
       }
       
       return property;
   }
});