(function() {
    var Ext = window.Ext4 || window.Ext;

    var getHiddenFieldConfig = function(name) {
        return {
            name: name,
            xtype: 'rallytextfield',
            hidden: true,
            handlesEvents: {
                typeselected: function(type) {
                    this.setValue(null);
                }
            }
        };
    };

    Ext.define('Rally.technicalservices.CustomGridWithDeepExportSettings', {
        singleton: true,
        requires: [
            'Rally.ui.combobox.FieldComboBox',
            'Rally.ui.combobox.ComboBox',
            'Rally.ui.CheckboxField'
        ],

        getFields: function() {

            var type_filters = Rally.data.wsapi.Filter.or([
                { property: 'TypePath', value: 'HierarchicalRequirement' },
                { property: 'TypePath', operator: 'contains', value: 'PortfolioItem/' }
            ]);

            return [{
                    name: 'type',
                    xtype: 'rallycombobox',
                    allowBlank: false,
                    autoSelect: false,
                    shouldRespondToScopeChange: true,
                    initialValue: 'HierarchicalRequirement',
                    storeConfig: {
                        model: Ext.identityFn('TypeDefinition'),
                        sorters: [{ property: 'DisplayName' }],
                        fetch: ['DisplayName', 'ElementName', 'TypePath', 'Parent', 'UserListable'],
                        //filters: type_filters,
                        filters: [{ property: 'UserListable', value: true }],
                        autoLoad: false,
                        remoteSort: false,
                        remoteFilter: true
                    },
                    displayField: 'DisplayName',
                    valueField: 'TypePath',
                    listeners: {
                        select: function(combo) {
                            combo.fireEvent('typeselected', combo.getRecord().get('TypePath'), combo.context);
                        }
                    },
                    bubbleEvents: ['typeselected'],
                    readyEvent: 'ready',
                    handlesEvents: {
                        projectscopechanged: function(context) {
                            this.refreshWithNewContext(context);
                        }
                    }
                },
                { type: 'query' },
                {
                    name: 'showControls',
                    xtype: 'rallycheckboxfield',
                    fieldLabel: 'Show Control Bar'
                },
                {
                    name: 'enableUrlSharing',
                    xtype: 'rallycheckboxfield',
                    fieldLabel: 'Enable URL Sharing of Saved Views'
                },
                getHiddenFieldConfig('columnNames'),
                getHiddenFieldConfig('order')
            ];
        }
    });
})();
