describe("HierarchyLoader Parent Fields", function () {

    beforeEach( function() {
        this.loader = Ext.create('Rally.technicalservices.HierarchyLoader',{
            model: 'hierarchicalrequirement',
            fetch: ['ObjectID'],
            filters: [],
            loadChildModels: ['task','defect','testcase', 'fred'],
            portfolioItemTypes: []
        });
    });

    it('should be ok with weird case', function () {
        expect(this.loader.getParentFieldFor('task','hierarchicalrequirement')).toEqual('WorkProduct');
        expect(this.loader.getParentFieldFor('tasK','hierArchicalrequirement')).toEqual('WorkProduct');
        expect(this.loader.getParentFieldFor('task','userstory')).toEqual('WorkProduct');
    });

    it('should know parent field on tasks', function () {
        expect(this.loader.getParentFieldFor('task','hierarchicalrequirement')).toEqual('WorkProduct');
        expect(this.loader.getParentFieldFor('task','defect')).toEqual('WorkProduct');
    });

    it('should know parent field on defects', function () {
        expect(this.loader.getParentFieldFor('defect','hierarchicalrequirement')).toEqual('Requirement');
        expect(this.loader.getParentFieldFor('defect','testcase')).toEqual('TestCase');
    });

    it('should know parent field on testcase', function () {
        expect(this.loader.getParentFieldFor('testcase','hierarchicalrequirement')).toEqual('WorkProduct');
        expect(this.loader.getParentFieldFor('testcase','defect')).toEqual('WorkProduct');
    });



});
