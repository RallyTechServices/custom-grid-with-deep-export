Ext.define('Rally.technicalservices.HierarchyLoader',{
    logger: new Rally.technicalservices.Logger(),

    storyModelName: 'hierarchicalrequirement',
    taskModelName: 'task',

    mixins: {
        observable: 'Ext.util.Observable'
    },

    model: undefined,
    filters: undefined,
    fetch: undefined,
    childModels: undefined,

    maxParallelCalls: 6,

    constructor: function (config) {
        this.mixins.observable.constructor.call(this, config);
        this.portfolioItemTypes = config.portfolioItemTypes || [];
        this.model = config.model || null;
        this.fetch = config.fetch || [];
        this.filters = config.filters || [];
        this.loadChildModels = config.loadChildModels || [];
    },
    load: function(){

        if (!this.model){
            this.fireEvent('hierarchyloaderror', "No model specified.");
            return;
        }
        if (this.portfolioItemTypes.length === 0){
            this.fireEvent('hierarchyloaderror', "Portfolio Item Types not initialized.");
            return;
        }
        if (!(this.loadChildModels instanceof Array)){
            this.fireEvent('hierarchyloaderror', "No child models specified.");
            return;
        }

        var fns = [];
        for (var i = 0; i< this.loadChildModels.length + 2; i++){
            fns.push(this.fetchNextLevel);
        }

        Deft.Chain.pipeline(fns, this).then({
            success: function(){
                this.fireEvent('hierarchyloadcomplete');
            },
            failure: function(msg){
                this.fireEvent('hierarchyloaderror', msg);
            },
            scope: this
        });
    },
    fetchNextLevel: function(args){
        this.logger.log('fetchNextLevel', args, args && args.length);

        if (!args){
            return this.fetchRoot();
        }

        args = _.flatten(args);
        this.logger.log('fetchNextLevel flattened args', args, args.length);
        if (args.length >  0) {

            var type = args[0].get('_type');

            this.fireEvent('hierarchyloadartifactsloaded', type, args);

            var portfolioItemTypePaths = _.pluck(this.portfolioItemTypes, 'typePath'),
                portfolioItemOrdinal = _.indexOf(portfolioItemTypePaths, type);

            if (portfolioItemOrdinal === 0 && Ext.Array.contains(this.loadChildModels, this.storyModelName)) {
                return this.fetchUserStories(args);
            }
            if (portfolioItemOrdinal > 0 && Ext.Array.contains(this.loadChildModels, portfolioItemTypePaths[portfolioItemOrdinal - 1])) {
                return this.fetchPortfolioItems(portfolioItemTypePaths[portfolioItemOrdinal - 1], args);
            }
            if (type === this.storyModelName && Ext.Array.contains(this.loadChildModels, this.taskModelName)){
                return this.fetchTasks(args);
            }
        }
        return Promise.resolve([]);
    },

    fetchRoot: function(){
        var fetch = this.fetch.concat(this.getRequiredFetchFields(this.model));
        this.fireEvent('statusupdate', "Loading artifacts");
        var config = {
            model: this.model,
            fetch: fetch,
            filters: this.filters
        };
        this.logger.log('fetchRoot config', config);

        return this.fetchWsapiRecords(config);
    },
    fetchPortfolioItems: function(type, parentRecords){

        var fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'Children', 'Count'),
            promises = [];

        this.fireEvent('statusupdate', 'Loading children for ' + parentRecords.length + ' artifacts');

        _.each(chunks, function(c){
            var filters = _.map(c, function(ids){ return {property: 'Parent.ObjectID', value: ids }; }),
                config = {
                    model: type,
                    fetch: fetch,
                    filters: Rally.data.wsapi.Filter.or(filters)
                };
            promises.push(function(){ return this.fetchWsapiRecords(config); });
        });

        this.logger.log('fetchPortfolioItems type', type, 'parentRecords', parentRecords);

        return this.throttle(promises, this.maxParallelCalls, this);
    },
    _getChunks: function(parentRecords, countField, countFieldAttribute){
        var chunks = [],
            childCount = 0,
            maxListSize = 25,
            childCountTarget = 200,
            idx = 0;

        chunks[idx] = [];
        _.each(parentRecords, function(r){
            var count = r.get(countField);
            if (countFieldAttribute && count){
                count = count[countFieldAttribute];
            }
            if (count > 0){  //using story count because it is a more accurate gauge of the number of user stories for a feature than UserStories.Count is, evne though it may not match exactly.
                childCount += count;
                if (childCount > childCountTarget || chunks[idx].length >= maxListSize){
                    idx++;
                    chunks[idx] = [];
                    childCount = 0;
                }
                chunks[idx].push(r.get('ObjectID'));
            }
        });
        return chunks;
    },
    fetchUserStories: function(parentRecords){
        var type = this.storyModelName,
            fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'LeafStoryCount'),
            promises = [],
            featureParentName = this.portfolioItemTypes[0].name.replace(/\s/g, '') + ".ObjectID";

        this.logger.log('fetchUserStories',fetch,  parentRecords, chunks);
        this.fireEvent('statusupdate', 'Loading User Stories for ' + parentRecords.length + ' Portfolio Items');

        _.each(chunks, function(c){
            var filters = _.map(c, function(id){ return {property: featureParentName, value: id }; }),
                config = {
                    model: type,
                    fetch: fetch,
                    filters: Rally.data.wsapi.Filter.or(filters)
                };
            promises.push(function(){ return this.fetchWsapiRecords(config); });
        });

        return this.throttle(promises, this.maxParallelCalls, this);
    },
    fetchTasks: function(parentRecords){
        var type = this.taskModelName,
            fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'Tasks', 'Count'),
            promises = [];

        this.logger.log('fetchTasks',fetch,  parentRecords, chunks);

        this.fireEvent('statusupdate', 'Loading Tasks for ' + parentRecords.length + ' User Stories');
        _.each(chunks, function(c){
            var filters = _.map(c, function(ids){ return {property: 'WorkProduct.ObjectID', value: ids }; }),
                config = {
                    model: type,
                    fetch: fetch,
                    filters: Rally.data.wsapi.Filter.or(filters)
                };
            promises.push(function(){ return this.fetchWsapiRecords(config); });
        });

        return this.throttle(promises, this.maxParallelCalls, this);
    },
    fetchWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('fetchWsapiRecords', config);
        Ext.create('Rally.data.wsapi.Store',{
                model: config.model,
                fetch: config.fetch,
                filters: config.filters,
                limit: 'Infinity'
            }).load({
                callback: function(records, operation){
                    if (operation.wasSuccessful()){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('fetchWsapiRecords error: ' + operation.error.errors.join(','));
                    }
                },
                scope: this
        });
        return deferred;
    },
    getRequiredFetchFields: function(type){
        if (/^portfolioitem/.test(type.toLowerCase())){
            return ['Children', 'LeafStoryCount','Parent','ObjectID'];
        }

        if (type.toLowerCase() === this.storyModelName){
            return ['Children','Tasks','Parent','PortfolioItem','ObjectID'];
        }

        if (type.toLowerCase() === this.taskModelName){
            return ['WorkProduct'];
        }
        return [];
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
    fetchWsapiRecordsWithPaging: function(config){
        var deferred = Ext.create('Deft.Deferred'),
            promises = [],
            me = this;

        this.fetchWsapiCount(config.model, config.filters).then({
            success: function(totalCount){
                var store = Ext.create('Rally.data.wsapi.Store',{
                        model: config.model,
                        fetch: config.fetch,
                        filters: config.filters,
                        pageSize: 200
                    }),
                    totalPages = Math.ceil(totalCount/200);

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
    },
    throttle: function (fns, maxParallelCalls, scope) {

        if (maxParallelCalls <= 0 || fns.length < maxParallelCalls){
            return Deft.promise.Chain.parallel(fns, scope);
        }


        var parallelFns = [],
            fnChunks = [],
            idx = -1;

        for (var i = 0; i < fns.length; i++) {
            if (i % maxParallelCalls === 0) {
                idx++;
                fnChunks[idx] = [];
            }
            fnChunks[idx].push(fns[i]);
        }

        _.each(fnChunks, function (chunk) {
            parallelFns.push(function () {
                return Deft.promise.Chain.parallel(chunk, scope);
            });
        });

        return Deft.Promise.reduce(parallelFns, function(groupResults, fnGroup) {
            return Deft.Promise.when(fnGroup.call(scope)).then(function(results) {
                groupResults = groupResults.concat(results || []);
                return groupResults;
            });
        }, []);
    }

});
