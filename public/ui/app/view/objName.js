/*
 * File: app/view/objName.js
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

Ext.define('iouLab.view.objName', {
    extend: 'Ext.window.Window',
    alias: 'widget.objName',

    requires: [
        'Ext.form.field.Display',
        'Ext.form.field.Number',
        'Ext.button.Split',
        'Ext.menu.ColorPicker',
        'Ext.slider.Single',
        'Ext.toolbar.Toolbar',
        'Ext.form.field.Checkbox',
        'Ext.toolbar.Fill'
    ],

    width: 532,
    title: 'Properties',
    modal: true,

    initComponent: function() {
        var me = this;

        Ext.applyIf(me, {
            items: [
                {
                    xtype: 'container',
                    frame: false,
                    itemId: 'fields',
                    margin: '5 5 5 5',
                    layout: 'fit',
                    items: [
                        {
                            xtype: 'displayfield',
                            itemId: 'type',
                            fieldLabel: 'Object Type',
                            labelAlign: 'right'
                        },
                        {
                            xtype: 'textfield',
                            itemId: 'text',
                            fieldLabel: 'Text',
                            labelAlign: 'right',
                            listeners: {
                                change: {
                                    fn: me.onTextChange,
                                    scope: me
                                }
                            }
                        },
                        {
                            xtype: 'numberfield',
                            itemId: 'fontSize',
                            fieldLabel: 'Font Size',
                            labelAlign: 'right',
                            maxValue: 30,
                            minValue: 1,
                            step: 0.5,
                            listeners: {
                                change: {
                                    fn: me.onFontSizeChange,
                                    scope: me
                                }
                            }
                        },
                        {
                            xtype: 'numberfield',
                            itemId: 'borderWidth',
                            fieldLabel: 'Border Width',
                            labelAlign: 'right',
                            maxValue: 30,
                            minValue: 0,
                            step: 0.5,
                            listeners: {
                                change: {
                                    fn: me.onFontSizeChange2,
                                    scope: me
                                }
                            }
                        },
                        {
                            xtype: 'numberfield',
                            itemId: 'dashArray',
                            fieldLabel: 'Dash Array',
                            labelAlign: 'right',
                            maxValue: 20,
                            minValue: 0,
                            listeners: {
                                change: {
                                    fn: me.onFontSizeChange1,
                                    scope: me
                                }
                            }
                        },
                        {
                            xtype: 'container',
                            itemId: 'color',
                            layout: {
                                type: 'hbox',
                                align: 'stretch'
                            },
                            items: [
                                {
                                    xtype: 'displayfield',
                                    flex: 1,
                                    itemId: 'color',
                                    fieldLabel: 'Color',
                                    labelAlign: 'right'
                                },
                                {
                                    xtype: 'splitbutton',
                                    cls: 'buttonClass',
                                    text: 'Select Color',
                                    menu: {
                                        xtype: 'colormenu',
                                        handler: function(obj, rgb) {
                                            console.log('Haaandler',arguments);
                                            var c = rgb.toString();
                                            obj.up('#fields').down('#color').down('#color').setValue('<SPAN STYLE="background:#'+c+'">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</SPAN>&nbsp;#'+c);
                                            if (obj.up('window').down('#autoSave').getValue()) helperObjSave(obj.up('window'));

                                        }
                                    }
                                }
                            ]
                        },
                        {
                            xtype: 'container',
                            itemId: 'background',
                            layout: {
                                type: 'hbox',
                                align: 'stretch'
                            },
                            items: [
                                {
                                    xtype: 'displayfield',
                                    flex: 1,
                                    itemId: 'color',
                                    fieldLabel: 'Background',
                                    labelAlign: 'right'
                                },
                                {
                                    xtype: 'splitbutton',
                                    cls: 'buttonClass',
                                    text: 'Select Color',
                                    menu: {
                                        xtype: 'colormenu',
                                        handler: function(obj, rgb) {
                                            console.log('Haaandler',arguments);
                                            var c = rgb.toString();
                                            obj.up('#fields').down('#background').down('#color').setValue('<SPAN STYLE="background:#'+c+'">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</SPAN>&nbsp;#'+c);
                                            if (obj.up('window').down('#autoSave').getValue()) helperObjSave(obj.up('window'));

                                        }
                                    }
                                }
                            ]
                        },
                        {
                            xtype: 'slider',
                            itemId: 'opacity',
                            fieldLabel: 'Opacity',
                            labelAlign: 'right',
                            value: 17,
                            listeners: {
                                change: {
                                    fn: me.onOpacityChange,
                                    scope: me
                                }
                            }
                        },
                        {
                            xtype: 'slider',
                            itemId: 'round',
                            fieldLabel: 'Round Corners',
                            labelAlign: 'right',
                            value: 0,
                            maxValue: 30,
                            listeners: {
                                change: {
                                    fn: me.onOpacityChange1,
                                    scope: me
                                }
                            }
                        }
                    ]
                }
            ],
            dockedItems: [
                {
                    xtype: 'toolbar',
                    dock: 'bottom',
                    items: [
                        {
                            xtype: 'checkboxfield',
                            itemId: 'autoSave',
                            fieldLabel: '',
                            hideEmptyLabel: false,
                            boxLabel: 'Real Time Update',
                            checked: true
                        },
                        {
                            xtype: 'tbfill'
                        },
                        {
                            xtype: 'button',
                            text: 'Save',
                            listeners: {
                                click: {
                                    fn: me.onButtonClick,
                                    scope: me
                                }
                            }
                        }
                    ]
                }
            ],
            listeners: {
                show: {
                    fn: me.onWindowShow,
                    scope: me
                }
            }
        });

        me.callParent(arguments);
    },

    onTextChange: function(field, newValue, oldValue, eOpts) {
        if (field.up('window').down('#autoSave').getValue()) helperObjSave(field.up('window'));

    },

    onFontSizeChange: function(field, newValue, oldValue, eOpts) {
        if (field.up('window').down('#autoSave').getValue()) helperObjSave(field.up('window'));

    },

    onFontSizeChange2: function(field, newValue, oldValue, eOpts) {
        if (field.up('window').down('#autoSave').getValue()) helperObjSave(field.up('window'));

    },

    onFontSizeChange1: function(field, newValue, oldValue, eOpts) {
        if (field.up('window').down('#autoSave').getValue()) helperObjSave(field.up('window'));

    },

    onOpacityChange: function(slider, newValue, thumb, eOpts) {
        if (slider.up('window').down('#autoSave').getValue()) helperObjSave(slider.up('window'));

    },

    onOpacityChange1: function(slider, newValue, thumb, eOpts) {
        if (slider.up('window').down('#autoSave').getValue()) helperObjSave(slider.up('window'));

    },

    onButtonClick: function(button, e, eOpts) {
        console.log('implement save');
        var w = button.up('window');
        helperObjSave(w,function() {
            w.close();
        });

    },

    onWindowShow: function(component, eOpts) {
        console.log('Edit Object',component);
        component.down('#fields').hide();
        Ext.Ajax.request({
            url: '/rest/object/'+component.objId,
            success: function(res) {
                var obj = Ext.JSON.decode(res.responseText);
                component.down('#type').setValue('<img width=12 height=12 src="icons/'+obj.type+'.png"> '+obj.type);
                component.down('#text').suspendEvents();
                component.down('#text').setValue(obj.text);
                component.down('#text').resumeEvents();
                component.down('#fontSize').suspendEvents();
                component.down('#fontSize').setValue(obj.fontSize);
                component.down('#fontSize').resumeEvents();
                component.down('#dashArray').suspendEvents();
                component.down('#dashArray').setValue(obj.dashArray||0);
                component.down('#dashArray').resumeEvents();
                component.down('#opacity').suspendEvents();
                component.down('#opacity').setValue(obj.opacity*100);
                component.down('#opacity').resumeEvents();
                component.down('#round').suspendEvents();
                component.down('#round').setValue(obj.round);
                component.down('#round').resumeEvents();
                component.down('#borderWidth').suspendEvents();
                component.down('#borderWidth').setValue(obj.strokeWidth);
                component.down('#borderWidth').resumeEvents();
                component.down('#color').down('#color').setValue('<SPAN STYLE="background:'+obj.color+'">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</SPAN>&nbsp;'+obj.color);
                component.down('#background').down('#color').setValue('<SPAN STYLE="background:'+obj.fill+'">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</SPAN>&nbsp;'+obj.fill);
                switch (obj.type) {
                    case 'rect':
                        //component.down('#fontSize').hide();
                        break;
                    case 'text':
                        component.down('#dashArray').hide();
                        component.down('#round').hide();
                        component.down('#background').hide();
                        component.down('#borderWidth').hide();
                        break;
                    case 'oval':
                        component.down('#round').hide();
                        //component.down('#fontSize').hide();
                        break;
                    default:
                        break;
                }
                component.down('#fields').show();
            }
        });


    }

});