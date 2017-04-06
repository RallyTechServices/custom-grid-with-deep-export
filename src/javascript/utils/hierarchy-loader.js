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
            chunks = this._getChunks(parentRecords, 'Children', 'Count');

        return this.fetchChunks(type, fetch, chunks, "Parent.ObjectID", Ext.String.format("Please Wait... Loading Children for {0} Portfolio Items", parentRecords.length));
    },
    _getChunks: function(parentRecords, countField, countFieldAttribute){
        var chunks = [],
            childCount = 0,
            maxListSize = 100,
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
            featureParentName = this.portfolioItemTypes[0].name.replace(/\s/g, '') + ".ObjectID";

        return this.fetchChunks(type, fetch, chunks, featureParentName, Ext.String.format("Please Wait... Loading User Stories for {0} Portfolio Items", parentRecords.length));
    },
    fetchTasks: function(parentRecords){
        var type = this.taskModelName,
            fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'Tasks', 'Count');

        return this.fetchChunks(type, fetch, chunks, "WorkProduct.ObjectID", Ext.String.format("Please Wait... Loading Tasks for {0} User Stories", parentRecords.length));
    },
    fetchChunks: function(type, fetch, chunks, chunkProperty, statusString){
        this.logger.log('fetchChunks',fetch,  chunkProperty, chunks);

        if (chunks && chunks.length > 0 && chunks[0].length===0){
            return Promise.resolve([]);
        }

        this.fireEvent('statusupdate', statusString);

        var promises = [];
        _.each(chunks, function(c){
            var filters = _.map(c, function(ids){ return {property: chunkProperty, value: ids }; }),
                config = {
                    model: type,
                    fetch: fetch,
                    filters: Rally.data.wsapi.Filter.or(filters),
                    context: {project: null}
                };
            promises.push(function(){ return this.fetchWsapiRecords(config); });
        });

        return this.throttle(promises, this.maxParallelCalls, this);
    },
    fetchWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');

        config.compact = false;
        config.limit = "Infinity";
        config.allowPostGet = true;

        Ext.create('Rally.data.wsapi.Store', config
            ).load({
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
            return ['FormattedID','Children','Tasks','Parent','PortfolioItem','HasParent','ObjectID'];
        }

        if (type.toLowerCase() === this.taskModelName){
            return ['WorkProduct','ObjectID'];
        }
        return [];
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
