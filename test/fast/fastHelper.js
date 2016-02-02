var useObjectID = function(value,record) {
    if ( record.get('ObjectID') ) {
        return record.get('ObjectID');
    } 
    return 0;
};

var shiftDayBeginningToEnd = function(day) {
    return Rally.util.DateTime.add(Rally.util.DateTime.add(Rally.util.DateTime.add(day,'hour',23), 'minute',59),'second',59);
};

Ext.define('mockportfolioitem/type4',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'Children',type:'auto'},
        {name:'Parent', type: 'auto'},
        {name:'LeafStoryCount', type: 'int'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
Ext.define('mockportfolioitem/type3',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'Children',type:'auto'},
        {name:'Parent', type: 'auto'},
        {name:'LeafStoryCount', type: 'int'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
Ext.define('mockportfolioitem/type2',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'Children',type:'auto'},
        {name:'Parent', type: 'auto'},
        {name:'LeafStoryCount', type: 'int'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
Ext.define('mockportfolioitem/type1',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'Children',type:'auto'},
        {name:'Parent', type: 'auto'},
        {name:'LeafStoryCount', type: 'int'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
Ext.define('mockportfolioitem/type0',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'UserStories',type:'auto'},
        {name:'Parent', type: 'auto'},
        {name:'LeafStoryCount', type: 'int'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});
Ext.define('mockuserstory',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'Children',type:'auto'},
        {name:'PortfolioItem',type:'auto'},
        {name:'Parent',type:'auto'},
        {name:'Type0',type:'auto'},
        {name:'Tasks', type:'auto'},
        {name:'id',type:'int',convert:useObjectID},
    ]
});

Ext.define('mocktask',{
    extend: 'Ext.data.Model',
    fields: [
        {name:'ObjectID', type: 'int'},
        {name:'Name',type:'string'},
        {name:'WorkProduct',type:'auto'},
        {name:'id',type:'int',convert:useObjectID}
    ]
});

