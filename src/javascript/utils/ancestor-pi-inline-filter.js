Ext.define('Utils.QuickFilterPanel', {
    override: 'Rally.ui.inlinefilter.QuickFilterPanel',
    portfolioItemTypes: [],
    modelName: undefined,
    
    initComponent: function() {
        var filterFactoryOverrides = {};
        var additionalFields = []
        _.each(this.portfolioItemTypes, function(piType) {
            var typePath = piType.get('TypePath');
            var displayName = 'Portfolio Item / ' + piType.get('Name');

            filterFactoryOverrides[typePath] = {
                   xtype: 'ancestorpisearchcombobox',
                   portfolioItemType: typePath, // The artifact type to search for
                   portfolioItemTypes: this.portfolioItemTypes,  // List of portfolio item types
                   artifactTypeName: this.modelName, // The artifact type we are filtering
                   storeConfig: {
                      models: typePath,
                      autoLoad: true
                  },
                    allowNoEntry: true,
                    noEntryValue: null,
                    noEntryText: 'No ' + displayName,
                    emptyText: 'Search ' + displayName + 's...',
                    allowClear: false,
                    valueField: 'ObjectID'
            };
            additionalFields.push({
              name: typePath,
              displayName: displayName
            })
       }, this);
       
       // Add the additional fields to the quick filter config
        _.merge(this.addQuickFilterConfig, {
                additionalFields: additionalFields
        }, function(a,b) {
            if (_.isArray(a)) {
                return a.concat(b)
            }
        });
        
        // Add the corresponding items to the FilterFieldFactory
        Ext.override(Rally.ui.inlinefilter.FilterFieldFactory, filterFactoryOverrides);
        
        this.callParent(arguments);
    }
});

Ext.define('Utils.AncestorPiSearchComboBox', {
    alias: 'widget.ancestorpisearchcombobox',
    extend: 'Rally.ui.combobox.ArtifactSearchComboBox',
    
    parentField: 'PortfolioItem.Parent.',
   
    artifactTypeName: undefined, // The name of the model that will be filtered
    portfolioItemTypes: [],
   
    getFilter: function() {
        
        var value = this.lastValue;
        var propertyPrefix = this.propertyPrefix();
        var filters = []
        if (value) {
            filters.push({
                property: propertyPrefix + ".ObjectID",
                value: value
            });
        } else {
            filters.push({
                property: propertyPrefix,
                value: null
            });
        }
        return Rally.data.wsapi.Filter.or(filters);
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