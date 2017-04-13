Ext.define("custom-grid-with-deep-export", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'}
    ],

    config: {
        defaultSettings: {
            columnNames: ['FormattedID', 'Name','ScheduleState'] ,
            query: '',
            showControls: true,
            type: 'HierarchicalRequirement',
            pageSize: 50
        }
    },

    integrationHeaders : {
        name : "custom-grid-with-deep-export"
    },

    disallowedAddNewTypes: ['user', 'userprofile', 'useriterationcapacity', 'testcaseresult', 'task', 'scmrepository', 'project', 'changeset', 'change', 'builddefinition', 'build', 'program'],
    orderedAllowedPageSizes: [10, 25, 50, 100, 200],
    readOnlyGridTypes: ['build', 'change', 'changeset'],
    statePrefix: 'customlist',
    allowExpansionStateToBeSaved: false,
    enableAddNew: true,

    launch: function () {
        this.fetchPortfolioItemTypes().then({
            success: function(portfolioItemTypes){
                this.portfolioItemTypes = portfolioItemTypes;
                this._buildStore();
            },
            failure: function(msg){
                this._showError(msg);
            },
            scope: this
        });

    },
    _buildStore: function(){

        this.modelNames = [this.getSetting('type')];
        this.logger.log('_buildStore', this.modelNames);
        var fetch = ['FormattedID', 'Name'];

        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.modelNames,
            enableHierarchy: true,
            fetch: fetch
        }).then({
            success: this._addGridboard,
            scope: this
        });
    },
    _addGridboard: function(store) {

        if (this.down('#display_box')){
            this.down('#display_box').removeAll();
        }

        var filters = this.getSetting('query') ? Rally.data.wsapi.Filter.fromQueryString(this.getSetting('query')) : [];
        this.logger.log('_addGridboard', store);


        this.gridboard = this.down('#display_box').add({
                xtype: 'rallygridboard',
                context: this.getContext(),
                modelNames: this.modelNames,
                toggleState: 'grid',
                plugins: [
                    'rallygridboardaddnew',
                    {
                        ptype: 'rallygridboardinlinefiltercontrol',
                        inlineFilterButtonConfig: {
                            stateful: true,
                            stateId: this.getContext().getScopedStateId('filters-1'),
                            modelNames: this.modelNames,
                            inlineFilterPanelConfig: {
                                quickFilterPanelConfig: {
                                    defaultFields: [
                                        'ArtifactSearch',
                                        'Owner',
                                        'ModelType',
                                        'Milestones'
                                    ]
                                }
                            }
                        }
                    },
                    {
                        ptype: 'rallygridboardfieldpicker',
                        headerPosition: 'left',
                        modelNames: this.modelNames
                        //stateful: true,
                        //stateId: this.getContext().getScopedStateId('columns-example')
                    },
                    {
                        ptype: 'rallygridboardactionsmenu',
                        menuItems: this._getExportMenuItems(),
                        buttonConfig: {
                            iconCls: 'icon-export'
                        }
                    }
                ],
                cardBoardConfig: {
                    attribute: 'ScheduleState'
                },
                gridConfig: {
                    store: store,
                    storeConfig: {
                        filters: filters
                    },
                    columnCfgs: [
                        'Name'
                    ]
                },
                height: this.getHeight()
        });
    },
    _getExportMenuItems: function(){
        this.logger.log('_getExportMenuItems', this.modelNames[0]);

        if (this.modelNames[0].toLowerCase() === 'hierarchicalrequirement'){
            return [{
                text: 'Export User Stories...',
                handler: this._export,
                scope: this,
                childModels: []
            },{
                text: 'Export User Stories and Tasks...',
                handler: this._export,
                scope: this,
                childModels: ['task']
            }];
        }

        //If its not a story, then its a PI
        var idx = _.indexOf(this.getPortfolioItemTypeNames(), this.modelNames[0].toLowerCase());
        var childModels = [];
        if (idx > 0){
            for (var i = idx; i > 0; i--){
                childModels.push(this.getPortfolioItemTypeNames()[i-1].toLowerCase());
            }
        }

        return [{
            text: 'Export Portfolio Items...',
            handler: this._export,
            scope: this,
            childModels: childModels
        },{
            text: 'Export Portfolio Items and User Stories...',
            handler: this._export,
            scope: this,
            includeStories: true,
            includeTasks: false,
            childModels: childModels.concat(['hierarchicalrequirement'])
        },{
            text: 'Export Portfolio Items, User Stories and Tasks...',
            handler: this._export,
            scope: this,
            childModels: childModels.concat(['hierarchicalrequirement','task'])
        }];
    },
    getPortfolioItemTypeNames: function(){
        return _.pluck(this.portfolioItemTypes, 'typePath');
    },

    _showError: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    _showStatus: function(message){
        this.logger.log('_showstatus', message, this);
        if (message) {
           Rally.ui.notify.Notifier.showStatus({
                message: message,
                showForever: true,
                closable: false,
                animateShowHide: false
            });
        } else {
            Rally.ui.notify.Notifier.hide();
        }
    },
    _getExportColumns: function(){
        var grid = this.down('rallygridboard').getGridOrBoard();
        if (grid){
            return _.filter(grid.columns, function(item){ return (item.dataIndex && item.dataIndex != "DragAndDropRank"); });
        }
        return [];
    },
    _getExportFilters: function(){
        var grid = this.down('rallygridboard'),
            filters = [],
            query = this.getSetting('query');

        if (grid.currentCustomFilter && grid.currentCustomFilter.filters){
            filters = grid.currentCustomFilter.filters;
        }
        if (query){
            if (filters && filters.length > 0){
                return filters.and(filters, Rally.data.wsapi.Filter.fromQueryString(query));
            } else {
                return Rally.data.wsapi.Filter.fromQueryString(query);
            }
        }
        return filters;
    },
    _getExportFetch: function(){
        var fetch =  _.pluck(this._getExportColumns(), 'dataIndex');
        if (Ext.Array.contains(fetch, 'TaskActualTotal')){
            fetch.push('Actuals');
        }
        return fetch;
    },
    _export: function(args){

        var columns = this._getExportColumns(),
            fetch = this._getExportFetch(),
            filters = this._getExportFilters(),
            modelName = this.modelNames[0],
            childModels = args.childModels;

        this.logger.log('_export', fetch, args, columns, filters.toString(), childModels);

        var exporter = Ext.create('Rally.technicalservices.HierarchyExporter', {
            fileName: 'hierarchy-export.csv',
            columns: columns,
            portfolioItemTypeObjects: this.portfolioItemTypes

        });
        exporter.on('exportupdate', this._showStatus, this);
        exporter.on('exporterror', this._showError, this);
        exporter.on('exportcomplete', this._showStatus, this);

        var hierarchyLoader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: modelName,
            fetch: fetch,
            filters: filters,
            loadChildModels: childModels,
            portfolioItemTypes: this.portfolioItemTypes,
            context: this.getContext().getDataContext()
        });
        hierarchyLoader.on('statusupdate', this._showStatus, this);
        hierarchyLoader.on('hierarchyloadartifactsloaded', exporter.setRecords, exporter);
        hierarchyLoader.on('hierarchyloadcomplete', exporter.export, exporter);
        hierarchyLoader.on('hierarchyloaderror', this._showError, this)
        hierarchyLoader.load();
    },
    getHeight: function () {
        var el = this.getEl();
        if (el) {
            var height = this.callParent(arguments);
            return Ext.isIE8 ? Math.max(height, 600) : height;
        }

        return 0;
    },

    setHeight: function(height) {
        this.callParent(arguments);
        if(this.gridboard) {
            this.gridboard.setHeight(height);
        }
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    getSettingsFields: function(){
        return Rally.technicalservices.CustomGridWithDeepExportSettings.getFields();
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this._buildStore();
    },
    fetchPortfolioItemTypes: function(){
        var deferred = Ext.create('Deft.Deferred');

        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'TypeDefinition',
            fetch: ['TypePath', 'Ordinal','Name'],
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            sorters: [{
                property: 'Ordinal',
                direction: 'ASC'
            }]
        });
        store.load({
            callback: function(records, operation, success){

                if (success){
                    var portfolioItemTypes = new Array(records.length);
                    _.each(records, function(d){
                        //Use ordinal to make sure the lowest level portfolio item type is the first in the array.
                        var idx = Number(d.get('Ordinal'));
                        portfolioItemTypes[idx] = { typePath: d.get('TypePath').toLowerCase(), name: d.get('Name') };
                        //portfolioItemTypes.reverse();
                    });
                    deferred.resolve(portfolioItemTypes);
                } else {
                    var error_msg = '';
                    if (operation && operation.error && operation.error.errors){
                        error_msg = operation.error.errors.join(',');
                    }
                    deferred.reject('Error loading Portfolio Item Types:  ' + error_msg);
                }
            }
        });
        return deferred.promise;
    }
});
