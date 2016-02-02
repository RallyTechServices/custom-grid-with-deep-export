Ext.define('Rally.technicalservices.CustomGridWithDeepExportExporter',{

    mixins: {
        observable: 'Ext.util.Observable'
    },

    saveCSVToFile:function(csv,file_name,type_object){
        if (type_object === undefined){
            type_object = {type:'text/csv;charset=utf-8'};
        }
        this.saveAs(csv,file_name, type_object);
    },
    saveAs: function(textToWrite, fileName)
    {
        if (Ext.isIE9m){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for IE9 and below."});
            return;
        }

        var textFileAsBlob = null;
        try {
            textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        }
        catch(e){
            window.BlobBuilder = window.BlobBuilder ||
                window.WebKitBlobBuilder ||
                window.MozBlobBuilder ||
                window.MSBlobBuilder;
            if (window.BlobBuilder && e.name == 'TypeError'){
                bb = new BlobBuilder();
                bb.append([textToWrite]);
                textFileAsBlob = bb.getBlob("text/plain");
            }

        }

        if (!textFileAsBlob){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for this browser."});
            return;
        }

        var fileNameToSaveAs = fileName;

        if (Ext.isIE10p){
            window.navigator.msSaveOrOpenBlob(textFileAsBlob,fileNameToSaveAs); // Now the user will have the option of clicking the Save button and the Open button.
            return;
        }

        var url = this.createObjectURL(textFileAsBlob);

        if (url){
            var downloadLink = document.createElement("a");
            if ("download" in downloadLink){
                downloadLink.download = fileNameToSaveAs;
            } else {
                //Open the file in a new tab
                downloadLink.target = "_blank";
            }

            downloadLink.innerHTML = "Download File";
            downloadLink.href = url;
            if (!Ext.isChrome){
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        } else {
            Rally.ui.notify.Notifier.showError({message: "Export is not supported "});
        }

    },
    createObjectURL: function ( file ) {
        if ( window.webkitURL ) {
            return window.webkitURL.createObjectURL( file );
        } else if ( window.URL && window.URL.createObjectURL ) {
            return window.URL.createObjectURL( file );
        } else {
            return null;
        }
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    },
    fetchExportData: function(rootModel, rootFilters, fetch, columns){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;


        var loadConfigs = this.getLoadConfigs(rootModel, fetch, rootFilters);

        Deft.Chain.pipeline([]).then({

        });
        PortfolioItemCostTracking.WsapiToolbox.fetchWsapiRecords(rootModel, rootFilters || [], rootFetch).then({
            scope: this,
            success: function(records){
                console.log('records',records, fetch);
                var loader = Ext.create('PortfolioItemCostTracking.RollupDataLoader',{
                    rootRecords: records,
                    additionalFetch: fetch,
                    listeners: {
                        rollupdataloaded: function(portfolioHash, stories){
                            var rollupData = Ext.create('PortfolioItemCostTracking.RollupCalculator', {});

                            portfolioHash[records[0].get('_type').toLowerCase()] = records;
                            rollupData.addRollupRecords(portfolioHash, stories);
                            rollupData.updateModels(records);

                            var exportData = me._getExportableRollupData(records,columns, rollupData);
                            columns = me._getAncestorTypeColumns(rootModel).concat(columns);

                            var csv = me._transformExportableRollupDataToDelimitedString(exportData, columns);
                            deferred.resolve(csv);
                        },
                        loaderror: function(msg){
                            deferred.reject(msg);
                        },
                        statusupdate: function(status){
                            this.fireEvent('statusupdate', status);
                        },
                        scope: this
                    }
                });
                loader.load(records);
            },
            failure: function(msg){
                deferred.reject(msg);
            }
        });
        return deferred;
    },
    _transformExportableRollupDataToDelimitedString: function(rollupData, columns){
        var csvArray = [],
            delimiter = ",",
            rowDelimiter = "\r\n",
            re = new RegExp(delimiter + '|\"|\r|\n','g');

        var column_keys = _.map(columns, function(c){ return c.costField || c.dataIndex; }),
            column_headers = _.pluck(columns, 'text');

        csvArray.push(column_headers.join(delimiter));

        Ext.Array.each(rollupData, function(obj){
            var data = [];
            Ext.Array.each(column_keys, function(key){
                var val = obj[key];
                if (val){
                    if (re.test(val)){ //enclose in double quotes if we have the delimiters
                        val = val.replace('"','\"\"');
                        val = Ext.String.format("\"{0}\"",val);
                    }
                }
                data.push(val);
            });
            csvArray.push(data.join(delimiter));
        });

        return csvArray.join(rowDelimiter);
    },
    /**
     * Returns an array of hash rollup data
     *
     * @param rootObjectIDs
     * @param columns - the data index of the columns that we want to export.
     * @param rollupData
     * @returns {Array}
     * @private
     */
    _getExportableRollupData: function(records, columns, rollupData){

        var exportData = [],
            me = this;


        _.each(records, function(r){
            var obj = rollupData.getRollupData(r);
            if (obj){
                var ancestors = {};
                var rec = obj.getExportRow(columns, ancestors);
                exportData.push(rec);
                me._addExportChildren(obj,exportData, columns, rollupData,ancestors);
            }
        }, this);
        return exportData;
    },
    _addExportChildren: function(obj, exportData, columns, rollupData,ancestors){
        var new_ancestors = Ext.clone(ancestors),
            me = this;
        new_ancestors[obj._type] = obj.FormattedID;

        var children = obj.children;
        if (children && children.length > 0){
            _.each(children, function(c){
                var row = c.getExportRow(columns, new_ancestors);
                exportData.push(row);
                me._addExportChildren(c, exportData, columns, rollupData, new_ancestors);
            }, this);
        }
        return;
    },
    _getAncestorTypeColumns: function(rootModel){
        var piTypes = PortfolioItemCostTracking.Settings.getPortfolioItemTypeObjects(),
            piIdx = -1;

        Ext.Array.each(piTypes, function(piObj, idx){
            if (piObj.typePath.toLowerCase() === rootModel.toLowerCase()){
                piIdx = idx;
            }
        });

        var columns = [{
            dataIndex: 'hierarchicalrequirement',
            text: 'User Story'
        }];

        if (piIdx >= 0){
            columns = columns.concat(Ext.Array.map(piTypes.slice(0,piIdx+1), function(piObj) { return { dataIndex: piObj.typePath.toLowerCase(), text: piObj.name };} ));
            columns.push({
                dataIndex: 'type',
                text: 'Artifact Type'
            });
            columns.reverse();
        }
        return columns;
    },
    constructor: function (config) {
        console.log('loader', this, config);
        this.mixins.observable.constructor.call(this, config);

        this.context = config && config.context || null;

        this.additionalFetch = config && config.additionalFetch || [];
        this.portfolioItemTypes = config.portfolioItemTypes;
    },
    load: function(rootRecords){

        if (!rootRecords || rootRecords.length === 0){
            return;
        }
        this.rootRecords = rootRecords;

        if (this._getPortfolioItemLevelsToFetch() > 0){

            this._fetchPortfolioItems();
        } else {
            this._fetchStories();
        }
    },
    _fetchStories: function(portfolioItemHash){
        var me = this;

        me.fireEvent('statusupdate',"Loading Stories");
        var portfolioRootLevel = me._getPortfolioItemLevelsToFetch();
        me.fetchWsapiRecordsWithPaging(me._getStoryConfig(portfolioRootLevel)).then({
            success: function(stories){
                me.fireEvent('statusupdate',"Processing data");
                //Setting a timeout here so that the processing data status update shows up
                setTimeout(function() {me.fireEvent('rollupdataloaded', portfolioItemHash || {}, stories);}, 50);
            },
            failure: function(msg){
                me.fireEvent('loaderror', 'Error fetching stories: ' + msg);
            },
            scope: this
        });

    },

    _fetchPortfolioItems: function(){
        var promises = [],
            portfolioRootLevel = this._getPortfolioItemLevelsToFetch();

        this.fireEvent('statusupdate',"Loading Portfolio Items");

        for (var i = 0; i <= portfolioRootLevel; i++){
            promises.push(this.fetchWsapiRecordsWithPaging(this._getPortfolioItemConfig(i, portfolioRootLevel)));
        }

        Deft.Promise.all(promises).then({
            success: function(results){
                var recordHash = {};
                _.each(results, function(records){
                    if (records && records.length > 0){
                        recordHash[records[0].get('_type')] = records;
                    }
                });
                this._fetchStories(recordHash);
            },
            failure: function(msg){
                this.fireEvent('loaderror', 'Error fetching portfolio items: ' + msg);
            },
            scope: this
        });

    },
    _getPortfolioItemLevelsToFetch: function(){
        var type = this.rootRecords[0].get('_type'),
            portfolioRootLevel = PortfolioItemCostTracking.Settings.getPortfolioItemTypeLevel(type);

        return portfolioRootLevel;
    },
    _getStoryConfig: function(portfolioRootLevel){
        return {
            model: 'hierarchicalrequirement',
            fetch: PortfolioItemCostTracking.Settings.getStoryFetch(this.additionalFetch),
            filters: this._buildFetchFilter(-1, portfolioRootLevel),
            statusDisplayString: "Loading data for {0} User Stories",
            completedStatusDisplayString: "Processing data"
        };
    },
    _getPortfolioItemConfig: function(idx, portfolioRootLevel){

        return {
            model: PortfolioItemCostTracking.Settings.getPortfolioItemTypes()[idx],
            fetch: PortfolioItemCostTracking.Settings.getPortfolioItemFetch(this.additionalFetch),
            filters: this._buildFetchFilter(idx, portfolioRootLevel),
            statusDisplayString: "Loading data for {0} Portfolio Items"
        };
    },
    _buildParentLevelString: function(idx, portfolioRootLevel){
        console.log('_buildParentLevelString', idx, portfolioRootLevel);
        var startIdx = idx,
            parentStringArray = [];

        if (idx < 0){
            startIdx = 0;
            parentStringArray.push("PortfolioItem");
        }

        parentStringArray = parentStringArray.concat(_.range(startIdx, portfolioRootLevel).map(function(){ return 'Parent'; }));
        parentStringArray.push("ObjectID");
        return parentStringArray.join('.');
    },
    _buildFetchFilter: function(idx, portfolioRootLevel){
        var records = this.rootRecords,
            parentLevelString = this._buildParentLevelString(idx, portfolioRootLevel),
            filters = _.map(records, function(r){ return {property: parentLevelString, value: r.get('ObjectID')}; });

        return Rally.data.wsapi.Filter.or(filters);
    },

    fetchWsapiCount: function(model, query_filters){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: ['ObjectID'],
            filters: query_filters,
            limit: 1,
            pageSize: 1
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(operation.resultSet.totalRecords);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} count for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    },
    fetchWsapiRecordsWithPaging: function(config, pageSize){
        var deferred = Ext.create('Deft.Deferred'),
            promises = [],
            me = this;

        if (!pageSize){
            pageSize = 200;
        }

        this.fetchWsapiCount(config.model, config.filters).then({
            success: function(totalCount){
                var store = Ext.create('Rally.data.wsapi.Store',{
                        model: config.model,
                        fetch: config.fetch,
                        filters: config.filters,
                        pageSize: pageSize
                    }),
                    totalPages = Math.ceil(totalCount/pageSize);

                var pages = _.range(1,totalPages+1,1);

                this.fireEvent('statusupdate',Ext.String.format(config.statusDisplayString || "Loading {0} artifacts", totalCount));

                _.each(pages, function(page){
                    promises.push(function () {return me.loadStorePage(page, store);});
                });

                PortfolioItemCostTracking.promise.ParallelThrottle.throttle(promises, 12, me).then({
                    success: function(results){
                        deferred.resolve(_.flatten(results));
                    },
                    failure: function(msg){
                        deferred.reject(msg);
                    },
                    scope: me
                });
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: me
        });
        return deferred;
    },
    loadStorePage: function(pageNum, store){
        var deferred = Ext.create('Deft.Deferred');

        store.loadPage(pageNum, {
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject('loadStorePage error: ' + operation.error.errors.join(','));
                }
            },
            scope: this
        });

        return deferred;
    }
});

