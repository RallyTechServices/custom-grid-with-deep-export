Ext.define('Utils.AncestorPiAppFilter', {
   alias: 'plugin.UtilsAncestorPiAppFilter',
   mixins: ['Ext.AbstractPlugin'],
   extend: 'Ext.Component',
   
   statics: {
        PI_SELECTED: 'Utils.AncestorPiAppFilter.PI_SELECTED',
        RENDER_AREA_ID: 'utils-ancestor-pi-app-filter'
   },
   
   piTypePaths: [],
   
   init: function(cmp) {
       this.cmp = cmp;
       this.cmp.getSettingsFields = _.compose(this.getSettingsFields, cmp.getSettingsFields);
       var appDefaults = this.cmp.defaultSettings;
       appDefaults['Utils.AncestorPiAppFilter.piType'] = null;
       this.cmp.setDefaultSettings(appDefaults);
       
       // Wait until app settings are ready before adding the control component
       this.cmp.on('beforelaunch', function() {
            this.addControlCmp(); 
       }, this);
       
       Rally.data.util.PortfolioItemHelper.getPortfolioItemTypes().then({
           scope: this,
           success: function(data) {
               this.piTypePaths = _.map(data, function(piType) {
                  return piType.get('TypePath'); 
               });
           }
       })
   },
   
   initComponent: function() {
        this.addEvents(Utils.AncestorPiAppFilter.PI_SELECTED);
   },
   
   getSettingsFields: function(fields) {
       return [{
           xtype: 'rallyportfolioitemtypecombobox',
            id: 'Utils.AncestorPiAppFilter.piType',
            name: 'Utils.AncestorPiAppFilter.piType',
            fieldLabel: 'Ancestor Portfolio Item Type',
            valueField: 'TypePath',
            allowNoEntry: true,
           // Needed to allow component to auto select '-- No Entry --' instead of lowest PI level
            defaultSelectionPosition: 'first'
        }
        ].concat(fields || []);
   },
   
   // Requires that app settings are available (e.g. from 'beforelaunch')
   addControlCmp: function() {
       if ( this.isAncestorFilterEnabled() ) {
           var selectedPiType = this.cmp.getSetting('Utils.AncestorPiAppFilter.piType');
           var renderArea = this.cmp.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID);
           if ( renderArea ) {
               this.piSelector = Ext.create('Rally.ui.combobox.ArtifactSearchComboBox', {
                   fieldLabel: "Ancestor Portfolio Item",
                   storeConfig: {
                      models: selectedPiType,
                      autoLoad: true
                  },
                  stateful: true,
                  stateId: this.cmp.getContext().getScopedStateId('Utils.AncestorPiAppFilter.piSelector'),
                  valueField: '_ref',
                  allowClear: true,
                  listeners: {
                      scope: this,
                      select: function(cmp, records) {
                          this.fireEvent(Utils.AncestorPiAppFilter.PI_SELECTED, this, records);
                      }
                  }
               });
               renderArea.add(this.piSelector);
           }
       }
   },
   
   isAncestorFilterEnabled: function() {
       var piType = this.cmp.getSetting('Utils.AncestorPiAppFilter.piType');
       return piType && piType != ''
   },
   
   getFiltersForType: function(type) {
       var result = []
       
       // Return no filter if not enabled OR if '-- Clear --' option selected
       // '-- None --' option has a value of null when selected (however value is '' on init)
       // so must also getRecord to determin if in None or Clear state.
       // '-- Clear --' option has a value of ''
       if ( this.isAncestorFilterEnabled() && this.piSelector.getValue() != '') {
           var selectedPi = this.piSelector.getValue();
           if ( this.piSelector.getRecord() && selectedPi != '') {
               var property;
               switch(type) {
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
                   var selectedPiType = this.cmp.getSetting('Utils.AncestorPiAppFilter.piType');
                   _.forEach(this.piTypePaths, function(piTypePath) {
                       if ( piTypePath == selectedPiType ) {
                           return false;
                       } else {
                           property = property + '.Parent'
                       }
                   });
                   
                   result.push(Rally.data.wsapi.Filter.or([{
                       property: property,
                       value: selectedPi
                   }]));
               }
           }
       }
       
       return result;
   }
});