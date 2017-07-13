describe("HierarchyLoader Child Fields", function () {

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
        expect(this.loader.getChildFieldFor('hierarchicalrequirement','task')).toEqual('Tasks');
        expect(this.loader.getChildFieldFor('hierarChicalrequirement','task')).toEqual('Tasks');
        expect(this.loader.getChildFieldFor('userstory','task')).toEqual('Tasks');
    });

    it('should know child fields on stories', function () {
        expect(this.loader.getChildFieldFor('hierarchicalrequirement','task')).toEqual('Tasks');
        expect(this.loader.getChildFieldFor('hierarchicalrequirement','defect')).toEqual('Defects');
        expect(this.loader.getChildFieldFor('hierarchicalrequirement','testcase')).toEqual('TestCases');
    });

    it('should know child fields on defects', function () {
        expect(this.loader.getChildFieldFor('defect','task')).toEqual('Tasks');
        expect(this.loader.getChildFieldFor('defect','testcase')).toEqual('TestCases');
    });

    it('should know child fields on test cases', function () {
        expect(this.loader.getChildFieldFor('testcase','task')).toEqual(null);
        expect(this.loader.getChildFieldFor('testcase','defect')).toEqual('Defects');
    });
});
