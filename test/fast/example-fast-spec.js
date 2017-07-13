describe("Example test set", function() {
    it('should render the app', function() {
        var app = Rally.test.Harness.launchApp("custom-grid-with-deep-export");
        expect(app.getEl()).toBeDefined();
    });

});
