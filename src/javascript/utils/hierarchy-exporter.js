Ext.define('Rally.technicalservices.HierarchyExporter', {

    logger: new Rally.technicalservices.Logger(),
    mixins: {
        observable: 'Ext.util.Observable'
    },

    records: undefined,

    constructor: function(config) {
        this.mixins.observable.constructor.call(this, config);
        this.modelName = config.modelName;
        this.records = [];
        this.fileName = config.fileName || "export.csv";
        this.columns = config.columns || [{ dataIndex: 'FormattedID', text: 'ID' }, { dataIndex: 'Name', text: 'Name' }];
        this.portfolioItemTypeObjects = config.portfolioItemTypeObjects || [];
    },
    setRecords: function(type, records) {
        this.records = (this.records || []).concat(records);
    },
    export: function() {

        this.fireEvent('exportupdate', "Preparing export data");

        this.logger.log('export', this.records, this);

        //var columns = _.filter(this.columns, function(c){ return c.dataIndex !== "FormattedID"; }),
        var columns = this.columns,
            hierarchicalData = this._buildHierarchy(),
            exportData = this._getExportableHierarchicalData(hierarchicalData, columns);

        var ancestorType = this.modelName.toLowerCase();
        if (hierarchicalData.length > 0) {
            ancestorType = hierarchicalData[0]._type;
        }
        columns = this._getAncestorTypeColumns(ancestorType).concat(columns);

        var csv = this._transformDataToDelimitedString(exportData, columns);

        this.saveCSVToFile(csv, this.fileName);
        this.fireEvent('exportcomplete');

    },
    _buildHierarchy: function() {
        var rootItems = [];
        this.logger.log('_buildHierarchy', this.records.length);

        var objectHash = _.reduce(this.records, function(objHash, record) {
            var oid = record.get('ObjectID');
            objHash[oid] = record.getData();
            objHash[oid].loadedChildren = [];
            return objHash;
        }, {});

        this.logger.log('_buildhierarchy Hash', objectHash)

        this.records = null;

        for (var key in objectHash) {
            /*
             * guess at parent based on populated field.  it is
             * possible for an item to have two parents (e.g., a defect
             * might have a story and a test case related "above" it
             * this will default to the first it finds
             */
            var obj = objectHash[key],
                parent = obj.Parent && obj.Parent.ObjectID ||
                obj.PortfolioItem && obj.PortfolioItem.ObjectID ||
                obj.WorkProduct && obj.WorkProduct.ObjectID ||
                obj.Requirement && obj.Requirement.ObjectID ||
                obj.TestCase && obj.TestCase.ObjectID;

            //   if (obj._type === 'task') { console.log('obj',parent, obj._type, obj)};
            if (parent && objectHash[parent]) {
                objectHash[parent].loadedChildren.push(obj);
            }
            else {
                var grandParent = obj.Parent && obj.Parent.Parent && obj.Parent.Parent.ObjectID || null;
                if (grandParent && objectHash[grandParent]) {
                    objectHash[grandParent].loadedChildren.push(obj);
                }
                else {
                    rootItems.push(obj);
                }
            }
        }
        return rootItems;
    },
    _transformDataToDelimitedString: function(data, columns) {
        var csvArray = [],
            delimiter = ",",
            rowDelimiter = "\r\n",
            re = new RegExp(delimiter + '|\"|\r|\n', 'g'),
            reHTML = new RegExp('<\/?[^>]+>', 'g'),
            reNbsp = new RegExp('&nbsp;', 'ig');

        var column_keys = _.map(columns, function(c) { return c.dataIndex; }),
            column_headers = _.pluck(columns, 'text');

        csvArray.push(column_headers.join(delimiter));

        Ext.Array.each(data, function(obj) {
            var data = [];
            Ext.Array.each(column_keys, function(key) {
                var val = obj[key];
                //console.log('column-key', key, obj);
                if (key === "Parent") {
                    val = obj[key] || obj['PortfolioItem'];
                }

                if (val) {
                    if (reHTML.test(val)) {
                        val = val.replace('<br>', '\r\n');
                        this.logger.log('html val', val);
                        val = Ext.util.Format.htmlDecode(val);
                        val = Ext.util.Format.stripTags(val);
                        this.logger.log('stripped html val', val);
                    }
                    if (reNbsp.test(val)) {
                        val = val.replace(reNbsp, ' ');
                    }

                    if (re.test(val)) { //enclose in double quotes if we have the delimiters
                        val = val.replace(/\"/g, '\"\"');
                        val = Ext.String.format("\"{0}\"", val);
                    }

                }
                data.push(val);
            }, this);
            csvArray.push(data.join(delimiter));
        }, this);

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
    _getExportableHierarchicalData: function(hierarchyData, columns) {

        var exportData = [];

        _.each(hierarchyData, function(r) {
            var ancestors = {};
            var rec = this._getExportDataRow(r, columns, ancestors);
            exportData.push(rec);
            this._addExportChildren(r, exportData, columns, ancestors);
        }, this);

        return exportData;
    },
    _addExportChildren: function(record, exportData, columns, ancestors) {
        var new_ancestors = Ext.clone(ancestors),
            me = this;

        if (Ext.isEmpty(new_ancestors[record._type])) {
            new_ancestors[record._type] = record.FormattedID;
        }

        var children = record.loadedChildren;
        if (children && children.length > 0) {
            _.each(children, function(c) {
                var row = this._getExportDataRow(c, columns, new_ancestors);
                // if this is a descendant of a story, set the field that
                // represents the User Story column to be the first level
                // level story
                var child_type = row._type;
                if (!Ext.isEmpty(new_ancestors[child_type])) {
                    row[child_type] = new_ancestors[child_type];
                }
                exportData.push(row);
                me._addExportChildren(c, exportData, columns, new_ancestors);
            }, this);
        }

        return;
    },
    getTypePathDisplayName: function(modelName) {
        if (modelName.toLowerCase() === 'hierarchicalrequirement') {
            return 'User Story';
        }
        if (modelName.toLowerCase() === 'task') {
            return 'Task';
        }
        if (modelName.toLowerCase() === 'defect') {
            return 'Defect';
        }
        if (modelName.toLowerCase() === 'testcase') {
            return 'Test Case';
        }

        var displayName = '';
        Ext.Array.each(this.portfolioItemTypeObjects, function(p) {
            if (p.get('TypePath').toLowerCase() === modelName.toLowerCase()) {
                displayName = p.get('Name');
                return false;
            }
        });
        return displayName;
    },
    _getExportDataRow: function(recData, columns, ancestors) {
        var rec = Ext.clone(ancestors),
            type = recData._type; //obj.getData('type');

        rec[type] = recData.FormattedID;
        rec.type = this.getTypePathDisplayName(recData._type);
        rec._type = recData._type;

        _.each(columns, function(c) {
            var field = c.dataIndex || null;
            if (field) {
                var data = recData[field];

                if (field === "Parent") {
                    data = recData[field] || recData["PortfolioItem"];
                }

                if (Ext.isObject(data)) {
                    if (data._tagsNameArray && data._tagsNameArray.length > 0) {
                        var names = _.pluck(data._tagsNameArray, 'Name');
                        rec[field] = names.join(',');
                    }
                    else if (data.FormattedID) {
                        rec[field] = data.FormattedID + ": " + data._refObjectName;
                    }
                    else {
                        rec[field] = data._refObjectName;
                    }
                }
                else if (Ext.isDate(data)) {
                    rec[field] = Rally.util.DateTime.formatWithDefaultDateTime(data);
                }
                else {
                    rec[field] = data;
                }
            }
        });

        return rec;
    },
    _getAncestorTypeColumns: function(rootModel) {
        var modelName = rootModel.toLowerCase();
        var columns = [];
        if (modelName == 'hierarchicalrequirement' || Ext.String.startsWith(modelName, 'portfolioitem')) {
            var piTypes = this.portfolioItemTypeObjects,
                piIdx = -1;

            Ext.Array.each(piTypes, function(piObj, idx) {
                if (piObj.get('TypePath').toLowerCase() === rootModel.toLowerCase()) {
                    piIdx = idx;
                }
            });

            columns.push({
                dataIndex: 'hierarchicalrequirement',
                text: 'User Story'
            });

            if (piIdx >= 0) {
                columns = columns.concat(Ext.Array.map(piTypes.slice(0, piIdx + 1), function(piObj) {
                    return {
                        dataIndex: piObj.get('TypePath').toLowerCase(),
                        text: piObj.get('Name')
                    };
                }));
                columns.push({
                    dataIndex: 'type',
                    text: 'Artifact Type'
                });

            }
            columns.reverse();
        }
        return columns;
    },
    saveCSVToFile: function(csv, file_name, type_object) {
        if (type_object === undefined) {
            type_object = { type: 'text/csv;charset=utf-8' };
        }
        this.saveAs(csv, file_name, type_object);
    },
    saveAs: function(textToWrite, fileName) {
        if (Ext.isIE9m) {
            Rally.ui.notify.Notifier.showWarning({ message: "Export is not supported for IE9 and below." });
            return;
        }

        var textFileAsBlob = null;
        try {
            textFileAsBlob = new Blob([textToWrite], { type: 'text/plain' });
        }
        catch (e) {
            window.BlobBuilder = window.BlobBuilder ||
                window.WebKitBlobBuilder ||
                window.MozBlobBuilder ||
                window.MSBlobBuilder;
            if (window.BlobBuilder && e.name == 'TypeError') {
                bb = new BlobBuilder();
                bb.append([textToWrite]);
                textFileAsBlob = bb.getBlob("text/plain");
            }

        }

        if (!textFileAsBlob) {
            Rally.ui.notify.Notifier.showWarning({ message: "Export is not supported for this browser." });
            return;
        }

        var fileNameToSaveAs = fileName;

        if (Ext.isIE10p) {
            window.navigator.msSaveOrOpenBlob(textFileAsBlob, fileNameToSaveAs); // Now the user will have the option of clicking the Save button and the Open button.
            return;
        }

        var url = this.createObjectURL(textFileAsBlob);

        if (url) {
            var downloadLink = document.createElement("a");
            if ("download" in downloadLink) {
                downloadLink.download = fileNameToSaveAs;
            }
            else {
                //Open the file in a new tab
                downloadLink.target = "_blank";
            }

            downloadLink.innerHTML = "Download File";
            downloadLink.href = url;
            if (!Ext.isChrome) {
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        }
        else {
            Rally.ui.notify.Notifier.showError({ message: "Export is not supported " });
        }

    },
    createObjectURL: function(file) {
        if (window.webkitURL) {
            return window.webkitURL.createObjectURL(file);
        }
        else if (window.URL && window.URL.createObjectURL) {
            return window.URL.createObjectURL(file);
        }
        else {
            return null;
        }
    },
    destroyClickedElement: function(event) {
        document.body.removeChild(event.target);
    }
});
