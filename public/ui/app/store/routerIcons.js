/*
 * File: app/store/routerIcons.js
 *
 * This file was generated by Sencha Architect version 3.0.0.
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

Ext.define('iouLab.store.routerIcons', {
    extend: 'Ext.data.Store',

    constructor: function(cfg) {
        var me = this;
        cfg = cfg || {};
        me.callParent([Ext.apply({
            autoLoad: true,
            storeId: 'routerIcons',
            fields: [
                {
                    name: 'id'
                },
                {
                    name: 'name'
                },
                {
                    name: 'width'
                },
                {
                    name: 'height'
                }
            ],
            proxy: {
                type: 'rest',
                url: '/rest/icons'
            }
        }, cfg)]);
    }
});