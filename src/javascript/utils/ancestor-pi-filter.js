Ext.define('ancestor-pi-filter', {
   alias: 'plugin.rallyappancestorpifilter',
   extend: 'Ext.AbstractPlugin',
   
   init: function(cmp) {
       this.cmp = cmp;
       this.cmp.getSettingsFields = _.compose(this.getSettingsFields, cmp.getSettingsFields);
       var appDefaults = this.cmp.defaultSettings;
       appDefaults['ancestor-pi-filter.enablePiAncestorFilter'] = false;
       this.cmp.setDefaultSettings(appDefaults);
       this.addControlCmp();
   },
   
   getSettingsFields: function(fields) {
       return [{
            xtype:'rallycheckboxfield',
            id: 'ancestor-pi-filter.enablePiAncestorFilter',
            name:'ancestor-pi-filter.enablePiAncestorFilter',
            fieldLabel: 'Enable Ancestor Portfolio Item Filter',
        },{
           xtype: 'rallyportfolioitemtypecombobox',
            id: 'ancestor-pi-filter.piType',
            name: 'ancestor-pi-filter.piType',
            fieldLabel: 'Ancestor Portfolio Item Type',
            valueField: 'TypePath'
        }
        ].concat(fields || []);
   },
   
   addControlCmp: function() {
       if ( this.isAncestorFilterEnabled() ) {
           var selectedPiType = this.cmp.getSetting('ancestor-pi-filter.piType');
           var renderArea = this.cmp.down('#ancestor-pi-filter');
           this.piSelector = Ext.create('Rally.ui.combobox.ArtifactSearchComboBox', {
               storeConfig: {
                  models: selectedPiType
              }
           });
           renderArea.add(this.piSelector);
       }
   },
   
   isAncestorFilterEnabled: function() {
       return this.cmp.getSetting('ancestor-pi-filter.enablePiAncestorFilter');
   },
   
   getFilters: function() {
       var result = []
       
       if ( this.isAncestorFilterEnabled() ) {
           var selectedPi = this.piSelector.getRecord();
           if ( selectedPi ) {
               result.push(Rally.data.wsapi.Filter.or([{
                   property: "PortfolioItem",
                   value: selectedPi.get('_ref')
               }]));
           }
       }
       
       return result;
   }
});