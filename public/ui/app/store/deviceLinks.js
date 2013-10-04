/*
 * File: app/store/deviceLinks.js
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

Ext.define('iouLab.store.deviceLinks', {
    extend: 'Ext.data.Store',

    constructor: function(cfg) {
        var me = this;
        cfg = cfg || {};
        me.callParent([Ext.apply({
            autoLoad: false,
            autoSync: true,
            storeId: 'deviceLinks',
            fields: [
                {
                    name: 'name'
                },
                {
                    name: 'id'
                },
                {
                    name: 'lab'
                },
                {
                    name: 'source'
                },
                {
                    name: 'target'
                },
                {
                    name: 'type'
                }
            ],
            proxy: {
                type: 'rest',
                url: '/rest/device/22/links'
            }
        }, cfg)]);
    }
});