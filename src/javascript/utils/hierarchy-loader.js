Ext.define('Rally.technicalservices.HierarchyLoader', {
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
    sorters: undefined,

    maxParallelCalls: 6,

    constructor: function(config) {
        this.mixins.observable.constructor.call(this, config);
        this.portfolioItemTypes = config.portfolioItemTypes || [];
        this.model = config.model || null;
        this.fetch = config.fetch || [];
        this.filters = config.filters || [];
        this.loadChildModels = config.loadChildModels || [];
        this.sorters = config.sorters || [];
    },
    load: function() {

        if (!this.model) {
            this.fireEvent('hierarchyloaderror', "No model specified.");
            return;
        }
        if (this.portfolioItemTypes.length === 0) {
            this.fireEvent('hierarchyloaderror', "Portfolio Item Types not initialized.");
            return;
        }
        if (!(this.loadChildModels instanceof Array)) {
            this.fireEvent('hierarchyloaderror', "No child models specified.");
            return;
        }

        var fns = [];
        for (var i = 0; i < this.loadChildModels.length + 4; i++) {
            fns.push(this.fetchNextLevel);
        }

        Deft.Chain.pipeline(fns, this).then({
            success: function() {
                this.fireEvent('hierarchyloadcomplete');
            },
            failure: function(msg) {
                this.fireEvent('hierarchyloaderror', msg);
            },
            scope: this
        });
    },
    fetchNextLevel: function(args) {
        this.logger.log('fetchNextLevel', args, args && args.length);

        if (!args) {
            return this.fetchRoot();
        }

        args = _.flatten(args);
        this.logger.log('fetchNextLevel flattened args', args, args.length);

        if (args.length > 0 && Ext.isFunction(args[0].get)) {
            var type = args[0].get('_type');
            var types = Ext.Array.unique(Ext.Array.map(args, function(arg) { return arg.get('_type'); }));

            this.fireEvent('hierarchyloadartifactsloaded', type, args);

            var portfolioItemTypePaths = _.map(this.portfolioItemTypes, function(type) {
                    return type.get('TypePath').toLowerCase();
                }),
                portfolioItemOrdinal = _.indexOf(portfolioItemTypePaths, type);

            if (portfolioItemOrdinal === 0 && Ext.Array.contains(this.loadChildModels, this.storyModelName)) {
                return this.fetchUserStories(args);
            }
            if (portfolioItemOrdinal > 0 && Ext.Array.contains(this.loadChildModels, portfolioItemTypePaths[portfolioItemOrdinal - 1])) {
                return this.fetchPortfolioItems(portfolioItemTypePaths[portfolioItemOrdinal - 1], args);
            }

            return this.fetchChildrenFromMultipleTypes(types, args);
            // if (type === this.storyModelName ) {
            // this.getAllowedChildTypes(type);
            // return this.fetchTasks(args);
            //}
        }
        return [];
    },

    fetchRoot: function() {
        var fetch = this.fetch.concat(this.getRequiredFetchFields(this.model));
        this.fireEvent('statusupdate', "Loading artifacts");
        var config = {
            model: this.model,
            fetch: fetch,
            filters: this.filters,
            sorters: this.sorters,
            context: this.context
        };
        this.logger.log('fetchRoot config', config);

        return this.fetchWsapiRecords(config);
    },
    fetchPortfolioItems: function(type, parentRecords) {

        var fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'Children', 'Count');

        return this.fetchChunks(type, fetch, chunks, "Parent.ObjectID", Ext.String.format("Please Wait... Loading Children for {0} Portfolio Items", parentRecords.length));
    },
    _getChunks: function(parentRecords, countField, countFieldAttribute) {
        this.logger.log("_getChunks", parentRecords, countField, countFieldAttribute);

        var chunks = [],
            childCount = 0,
            maxListSize = 100,
            childCountTarget = 200,
            idx = 0;

        chunks[idx] = [];
        _.each(parentRecords, function(r) {
            var count = r.get(countField);
            if (countFieldAttribute && count) {
                count = count[countFieldAttribute];
            }
            if (count > 0) { //using story count because it is a more accurate gauge of the number of user stories for a feature than UserStories.Count is, evne though it may not match exactly.
                childCount += count;
                if (childCount > childCountTarget || chunks[idx].length >= maxListSize) {
                    idx++;
                    chunks[idx] = [];
                    childCount = 0;
                }
                chunks[idx].push(r.get('ObjectID'));
            }
        });

        return chunks;
    },
    fetchUserStories: function(parentRecords) {
        var type = this.storyModelName,
            fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            chunks = this._getChunks(parentRecords, 'LeafStoryCount'),
            featureParentName = this.portfolioItemTypes[0].get('Name').replace(/\s/g, '') + ".ObjectID";

        return this.fetchChunks(type, fetch, chunks, featureParentName, Ext.String.format("Please Wait... Loading User Stories for {0} Portfolio Items", parentRecords.length));
    },

    fetchChildrenFromMultipleTypes: function(types, parentRecords) {
        this.logger.log('fetchChildrenFromMultipleTypes', types, parentRecords);

        var promises = [];
        Ext.Array.map(types, function(type) {
            child_types = this.getAllowedChildTypes(type);
            if (child_types.length > 0) {
                var parents = Ext.Array.filter(parentRecords, function(parent) {
                    return (parent.get('_type') == type);
                }, this);
                promises.push(function() {
                    return this.fetchChildrenOfMultipleTypes(parents);
                });
            }
        }, this);

        if (promises.length === 0) { return []; }
        return Deft.Chain.sequence(promises, this);
    },
    fetchChildrenOfMultipleTypes: function(parentRecords) {
        var parent_type = parentRecords[0].get('_type');
        var child_types = this.getAllowedChildTypes(parent_type);
        this.logger.log('fetchChildrenOfMultipleTypes', child_types, parentRecords);
        var promises = Ext.Array.map(child_types, function(type) {
            return function() { return this.fetchChildren(type, parentRecords); }
        }, this);

        return Deft.Chain.sequence(promises, this);
    },

    fetchChildren: function(type, parentRecords) {
        this.logger.log("fetchChildren", type, parentRecords);
        var fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
            parentType = parentRecords[0].get('_type'),
            childField = this.getChildFieldFor(parentType, type),
            chunks = this._getChunks(parentRecords, childField, 'Count'),
            parentField = this.getParentFieldFor(type, parentType);

        return this.fetchChunks(type, fetch, chunks, parentField + ".ObjectID",
            Ext.String.format("Please Wait... Loading {0} for {1} items", childField, parentRecords.length));
    },

    // fetchTasks: function(parentRecords){
    //     var type = this.taskModelName,
    //         fetch = this.fetch.concat(this.getRequiredFetchFields(type)),
    //         chunks = this._getChunks(parentRecords, 'Tasks', 'Count');
    //
    //     return this.fetchChunks(type, fetch, chunks, "WorkProduct.ObjectID", Ext.String.format("Please Wait... Loading Tasks for {0} User Stories", parentRecords.length));
    // },
    fetchChunks: function(type, fetch, chunks, chunkProperty, statusString) {
        this.logger.log('fetchChunks', fetch, chunkProperty, chunks);

        if (!chunks || chunks.length === 0) {
            return [];
        }
        if (chunks[0].length === 0) {
            return [];
        }

        this.fireEvent('statusupdate', statusString);

        var promises = [];
        _.each(chunks, function(c) {
            var filters = _.map(c, function(ids) { return { property: chunkProperty, value: ids }; }),
                config = {
                    model: type,
                    fetch: fetch,
                    sorters: [
                        { property: 'TaskIndex', direction: 'ASC' },
                        { property: 'DragAndDropRank', direction: 'ASC' }
                    ],
                    filters: Rally.data.wsapi.Filter.or(filters),
                    context: { project: null }
                };
            promises.push(function() { return this.fetchWsapiRecords(config); });
        });

        return this.throttle(promises, this.maxParallelCalls, this);
    },
    fetchWsapiRecords: function(config) {
        var deferred = Ext.create('Deft.Deferred');

        config.compact = false;
        config.limit = "Infinity";
        config.allowPostGet = true;

        Ext.create('Rally.data.wsapi.Store', config).load({
            callback: function(records, operation) {
                if (operation.wasSuccessful()) {
                    deferred.resolve(records);
                }
                else {
                    deferred.reject('fetchWsapiRecords error: ' + operation.error.errors.join(','));
                }
            },
            scope: this
        });
        return deferred;
    },

    getChildFieldFor: function(parent_type, child_type) {
        if (parent_type.toLowerCase() === "hierarchicalrequirement" || parent_type.toLowerCase() === "userstory") {
            if (child_type.toLowerCase() == "task") { return 'Tasks'; }
            if (child_type.toLowerCase() == "defect") { return 'Defects'; }
            if (child_type.toLowerCase() == "testcase") { return 'TestCases'; }
            if (child_type.toLowerCase() == "hierarchicalrequirement") { return 'Children'; }
        }
        if (parent_type.toLowerCase() === "defect") {
            if (child_type.toLowerCase() == "task") { return 'Tasks'; }
            if (child_type.toLowerCase() == "testcase") { return 'TestCases'; }
        }
        if (parent_type.toLowerCase() === "testcase") {
            if (child_type.toLowerCase() == "defect") { return 'Defects'; }
        }
        if (/portfolioitem/.test(parent_type.toLowerCase())) {
            if (child_type.toLowerCase() == "hierarchicalrequirement") { return 'UserStories'; }
        }
        return null;
    },

    getParentFieldFor: function(child_type, parent_type) {
        if (parent_type.toLowerCase() === "hierarchicalrequirement" || parent_type.toLowerCase() === "userstory") {
            if (child_type.toLowerCase() == "task") { return 'WorkProduct'; }
            if (child_type.toLowerCase() == "defect") { return 'Requirement'; }
            if (child_type.toLowerCase() == "testcase") { return 'WorkProduct'; }
            if (child_type.toLowerCase() == "hierarchicalrequirement") { return 'Parent'; }
        }
        if (parent_type.toLowerCase() === "defect") {
            if (child_type.toLowerCase() == "task") { return 'WorkProduct'; }
            if (child_type.toLowerCase() == "testcase") { return 'WorkProduct'; }
        }
        if (parent_type.toLowerCase() === "testcase") {
            if (child_type.toLowerCase() == "defect") { return 'TestCase'; }
        }
        if (/portfolioitem/.test(parent_type.toLowerCase())) {
            if (child_type.toLowerCase() == "hierarchicalrequirement") { return 'PortfolioItem'; }
        }
        return null;

    },
    getAllowedChildTypes: function(type) {
        var allowed_types = [];
        var given_types = this.loadChildModels;

        if (type.toLowerCase() === this.storyModelName.toLowerCase()) {
            allowed_types = ['task', 'defect', 'testcase', this.storyModelName.toLowerCase()];
        }
        if (type.toLowerCase() === 'defect') {
            allowed_types = ['task', 'testcase'];
        }
        if (type.toLowerCase() === 'testcase') {
            allowed_types = ['defect'];
        }

        var types_in_both = Ext.Array.intersect(allowed_types, given_types);
        return types_in_both;
    },

    getRequiredFetchFields: function(type) {
        if (/^portfolioitem/.test(type.toLowerCase())) {
            return ['Children', 'LeafStoryCount', 'Parent', 'ObjectID', 'UserStories'];
        }

        if (type.toLowerCase() === this.storyModelName) {
            return ['FormattedID', 'Children', 'Tasks', 'Parent', 'PortfolioItem', 'HasParent', 'ObjectID', 'TestCases', 'Defects'];
        }

        return ['ObjectID', 'WorkProduct', 'Defects', 'Tasks', 'TestCases', 'Requirement', 'TestCase', 'FormattedID'];
    },
    throttle: function(fns, maxParallelCalls, scope) {

        if (maxParallelCalls <= 0 || fns.length < maxParallelCalls) {
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

        _.each(fnChunks, function(chunk) {
            parallelFns.push(function() {
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
