/*
 * File: app/view/links.js
 *
 * This file was generated by Sencha Architect version 3.1.0.
 * http://www.sencha.com/products/architect/
 *
 * This file requires use of the Ext JS 4.2.x library, under independent license.
 * License of Sencha Architect does not include license for Ext JS 4.2.x. For more
 * details see http://www.sencha.com/license or contact license@sencha.com.
 *
 * This file will be auto-generated each and everytime you save your project.
 *
 * Do NOT hand edit this file.
 */

Ext.define('iouLab.view.links', {
    extend: 'Ext.window.Window',
    alias: 'widget.links',

    requires: [
        'Ext.grid.Panel',
        'Ext.grid.View',
        'Ext.grid.column.Template',
        'Ext.XTemplate',
        'Ext.form.field.Text',
        'Ext.grid.plugin.RowEditing'
    ],

    width: 1000,
    title: 'Device Links',
    titleAlign: 'center',
    modal: true,

    initComponent: function() {
        var me = this;

        Ext.applyIf(me, {
            items: [
                {
                    xtype: 'gridpanel',
                    forceFit: true,
                    store: 'deviceLinks',
                    columns: [
                        {
                            xtype: 'gridcolumn',
                            hidden: true,
                            dataIndex: 'id',
                            text: 'Id',
                            flex: 1
                        },
                        {
                            xtype: 'gridcolumn',
                            hidden: true,
                            dataIndex: 'lab',
                            text: 'Lab',
                            flex: 1
                        },
                        {
                            xtype: 'gridcolumn',
                            dataIndex: 'type',
                            text: 'Type',
                            flex: 1
                        },
                        {
                            xtype: 'gridcolumn',
                            renderer: function(value, metaData, record, rowIndex, colIndex, store, view) {
                                var r = Ext.StoreMgr.get('labDevices').getById(value.id);
                                return r?r.get('name'):'';

                            },
                            dataIndex: 'source',
                            text: 'Source Device',
                            flex: 2
                        },
                        {
                            xtype: 'templatecolumn',
                            tpl: [
                                '{source.name}'
                            ],
                            dataIndex: 'source',
                            text: 'Source Interface',
                            flex: 2
                        },
                        {
                            xtype: 'gridcolumn',
                            renderer: function(value, metaData, record, rowIndex, colIndex, store, view) {
                                var r = Ext.StoreMgr.get('labDevices').getById(value.id);
                                return r?r.get('name'):'';

                            },
                            dataIndex: 'target',
                            text: 'Target Device',
                            flex: 2
                        },
                        {
                            xtype: 'templatecolumn',
                            tpl: [
                                '{source.name}',
                                ''
                            ],
                            dataIndex: 'target',
                            text: 'Target Interface',
                            flex: 2
                        },
                        {
                            xtype: 'gridcolumn',
                            dataIndex: 'name',
                            text: 'Link Name',
                            flex: 2,
                            editor: {
                                xtype: 'textfield'
                            }
                        }
                    ],
                    plugins: [
                        Ext.create('Ext.grid.plugin.RowEditing', {

                        })
                    ]
                }
            ]
        });

        me.callParent(arguments);
    }

});