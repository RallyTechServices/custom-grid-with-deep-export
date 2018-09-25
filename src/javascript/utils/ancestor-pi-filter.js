Ext.define('ancestor-pi-filter', {
   alias: 'plugin.rallyappancestorpifilter',
   mixins: ['Ext.AbstractPlugin'],
   extend: 'Ext.Component',
   
   init: function(cmp) {
       this.cmp = cmp;
       this.cmp.getSettingsFields = _.compose(this.getSettingsFields, cmp.getSettingsFields);
       var appDefaults = this.cmp.defaultSettings;
       appDefaults['ancestor-pi-filter.enablePiAncestorFilter'] = false;
       this.cmp.setDefaultSettings(appDefaults);
       this.addControlCmp();
   },
   
   initComponent: function() {
        this.addEvents('select');
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
           if ( renderArea ) {
               this.piSelector = Ext.create('Rally.ui.combobox.ArtifactSearchComboBox', {
                   fieldLabel: "Ancestor Portfolio Item",
                   storeConfig: {
                      models: selectedPiType
                  },
                  allowClear: true,
                  listeners: {
                      scope: this,
                      select: function(cmp, records) {
                          this.fireEvent('select', this, records);
                      }
                  }
               });
               renderArea.add(this.piSelector);
           }
       }
   },
   
   isAncestorFilterEnabled: function() {
       return this.cmp.getSetting('ancestor-pi-filter.enablePiAncestorFilter');
   },
   
   getFilters: function() {
       var result = []
       
       // Return no filter if not enabled OR if '-- Clear --' option selected
       // '-- None --' option has a value of null
       // '-- Clear --' option has a value of ''
       if ( this.isAncestorFilterEnabled() && this.piSelector.getValue() != '') {
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