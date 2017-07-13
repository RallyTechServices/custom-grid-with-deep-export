describe("When given a hierarchy loader", function () {
    it('should identify child types for stories', function () {
        var loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: ['task'],
            portfolioItemTypes: []
        });
        expect(loader.getAllowedChildTypes('hierarchicalrequirement')).toEqual(['task']);
    });
    it('should identify child types for stories when provided more than one', function () {
        var loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: ['task','defect','testcase', 'fred'],
            portfolioItemTypes: []
        });
        expect(loader.getAllowedChildTypes('hierarchicalrequirement')).toEqual(['task','defect','testcase']);
    });
    it('should not identify child types for stories when asked not to', function () {
        var loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: [],
            portfolioItemTypes: []
        });
        expect(loader.getAllowedChildTypes('hierarchicalrequirement')).toEqual([]);
    });
    it('should identify child type for defects when provided more than one', function () {
        var loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: ['task','defect','testcase', 'fred'],
            portfolioItemTypes: []
        });
        expect(loader.getAllowedChildTypes('defect')).toEqual(['task','testcase']);
    });
    it('should identify no child type for testcases', function () {
        var loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: ['task','defect','testcase', 'fred'],
            portfolioItemTypes: []
        });
        expect(loader.getAllowedChildTypes('testcase')).toEqual(['defect']);
    });
});
