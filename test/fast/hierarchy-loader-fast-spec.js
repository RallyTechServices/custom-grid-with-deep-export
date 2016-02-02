describe("Hierarchy Exporter Tests", function() {
        describe("When working with artifact records for an iteration", function () {


            var createArtifact = function (type, objectId, fields) {
                var a = Ext.create(type);
                a.set('ObjectID', objectId);

                _.each(fields, function(val, key){
                    a.set(key, val);
                });
                return a;
            };


            var portfolioItemTypes = ['mockportfolioitem/type0', 'mockportfolioitem/type1', 'mockportfolioitem/type2', 'mockportfolioitem/type3', 'mockportfolioitem/type4'],
                model = 'mockportfolioitem/type4',
                fetch = ['FormattedID','Name'];

            var typeRecordsHash = {},
                objectId = 0;

            typeRecordsHash["mockportfolioitem/type4"] = [
                createArtifact('mockportfolioitem/type4',1,{
                    Children: {Count: 1}
                })
            ];

            typeRecordsHash["mockportfolioitem/type3"] = [
                createArtifact('mockportfolioitem/type3',2,{
                    Parent: {ObjectID: 1},
                    Children: {Count: 2}
                })
            ];

            typeRecordsHash["mockportfolioitem/type2"] = [
                createArtifact('mockportfolioitem/type2',3,{
                    Parent: {ObjectID: 2},
                    Children: {Count: 2}
                }),
                createArtifact('mockportfolioitem/type2',4,{
                    Parent: {ObjectID: 2},
                    Children: {Count: 0}
                }),
                createArtifact('mockportfolioitem/type2',5,{
                    Parent: {ObjectID: 2},
                    Children: ""
                })
            ];

            typeRecordsHash["mockportfolioitem/type1"] = [
                createArtifact('mockportfolioitem/type1',6,{
                    Parent: {ObjectID: 3},
                    Children: {Count: 2}
                }),
                createArtifact('mockportfolioitem/type1',7,{
                    Parent: {ObjectID: 3},
                    Children: {Count: 2}
                })
            ];

            typeRecordsHash["mockportfolioitem/type0"] = [
                createArtifact('mockportfolioitem/type0',8,{
                    Parent: {ObjectID: 6},
                    LeafStoryCount: 2
                }),
                createArtifact('mockportfolioitem/type0',9,{
                    Parent: {ObjectID: 6},
                    LeafStoryCount: 0
                }),
                createArtifact('mockportfolioitem/type0',10,{
                    Parent: {ObjectID: 7},
                    LeafStoryCount: 1
                }),
                createArtifact('mockportfolioitem/type0',11,{
                    Parent: {ObjectID: 7},
                    LeafStoryCount: 0
                })
            ];

            typeRecordsHash["mockuserstory"] = [
                createArtifact('mockuserstory',12,{
                    Type0: {ObjectID: 8},
                    Parent: "",
                    PortfolioItem: {ObjectID: 8},
                    Children: {Count: 2},
                    Tasks: ""
                }),
                createArtifact('mockuserstory',13,{
                    Type0: {ObjectID: 8},
                    Parent: "",
                    PortfolioItem: {ObjectID: 8},
                    Children: "",
                    Tasks: { Count: 2}
                }),
                createArtifact('mockuserstory',14,{
                    Parent: {ObjectID: 12},
                    PortfolioItem: "",
                    Children: {Count: 1},
                    Tasks: {}
                }),
                createArtifact('mockuserstory',15,{
                    Parent: {ObjectID: 14},
                    PortfolioItem: "",
                    Children: "",
                    Tasks: { Count: 2}
                }),
                createArtifact('mockuserstory',16,{
                    Parent: "",
                    PortfolioItem: {ObjectID: 10},
                    Children: "",
                    Tasks: ""
                })
            ];

            it('should build a hierarchical data structure', function () {

                var calculator = Ext.create('Rally.technicalservices.IterationHealthBulkCalculator', {
                    doneStates: ["Accepted", "Released"],
                    iterationRecords: iterationRecords,
                    artifactRecords: artifactRecords
                });

                var hash = calculator.getVelocityByIterationHash();

                expect(hash["101"]).toEqual(6);
                expect(hash["102"]).toEqual(13);
            });
        });
});