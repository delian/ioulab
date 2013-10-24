/**
 * A bunch of helper functions
 */

var t;
var th;

function hideTip() {
    if (th) clearTimeout(th);
    th = setTimeout(function(){
        if (t && t.hide) t.hide();
    },500);
}

function showTip(obj,objModel) {
    if (th) clearTimeout(th);
    th=0;
    if (t && t.hide) t.hide();
    console.log('To show tip for object',obj);
    var ht = '<DIV STYLE="overflow:hidden"><CENTER><IMG SRC="'+obj.oMsg.icon+'" WIDTH=20 HEIGHT=20></CENTER>'+
        '<TABLE BORDER=0 WIDTH=100% CELLSPACING=0 CELLPADDING=0>' +
        '<TR><TD ALIGN=RIGHT><B>Name:</B></TD><TD NOWRAP>&nbsp;'+obj.oMsg.name+'</TD></TR>'+
        '<TR><TD ALIGN=RIGHT><B>Status:</B></TD><TD NOWRAP>&nbsp;'+obj.oMsg.status+'</TD></TR>'+
        '</TABLE><BR><CENTER>'+
        '<IMG class="tooltipStart" STYLE="cursor:pointer" SRC="icons/start.png" WIDTH=15 HEIGHT=15>&nbsp;'+
        '<IMG class="tooltipStop" STYLE="cursor:pointer" SRC="icons/stop.png" WIDTH=15 HEIGHT=15>&nbsp;'+
        '<IMG class="tooltipTerminal" STYLE="cursor:pointer" SRC="icons/terminal.png" WIDTH=15 HEIGHT=15>&nbsp;'+
        '</CENTER></DIV>';
    t=Ext.create('Ext.tip.ToolTip', { html: ht, width: 150, height: 100, hideDelay: 2500 });
    t.on('show',function() {
        if (!t.getEl()) return;
        console.log('showed',t.getEl());
        var el = t.getEl();
        el.on('mouseover',function() {
            if (th) clearTimeout(th);
        });
        el.on('mouseout',function() {
            hideTip();
        });
        var e = el.dom.getElementsByClassName('tooltipStart')[0];
        if (e)  e.onclick=function() {
          console.log('Start clicked');
            Ext.Ajax.request({
                url: '/rest/device/'+obj.oMsg.id+'/start',
                success: function(res) {
                    console.log('Device started');
                }
            });
          hideTip();
        };
        e = el.dom.getElementsByClassName('tooltipStop')[0];
        if (e) e.onclick=function() {
          console.log('Stop clicked');
            Ext.Ajax.request({
                url: '/rest/device/'+obj.oMsg.id+'/stop',
                success: function(res) {
                    console.log('Device stopped');
                }
            });
          hideTip();
        };
        e = el.dom.getElementsByClassName('tooltipTerminal')[0];
        if (e) e.onclick=function() {
          console.log('Terminal clicked');
          openTerminal(obj.oMsg.id);
          hideTip();
        };
    });
    th=setTimeout(function(){
        t.showAt([objModel.clientX+15,objModel.clientY+15]);
    },300);
}

function helperObjSave(c,cb) {
    var color = c.down('#color').down('#color').value.match(/(.......)$/)[1]; // unsafe
    var fill = c.down('#background').down('#color').value.match(/(.......)$/)[1];
    console.log(color,fill);
    Ext.Ajax.request({
        method: 'PUT',
        url: '/rest/object/'+c.objId,
        jsonData: Ext.JSON.encode({
            text: c.down('#text').getValue(),
            fontSize: c.down('#fontSize').getValue(),
            opacity: (c.down('#opacity').getValue()/100),
            dashArray: c.down('#dashArray').getValue(),
            round: c.down('#round').getValue(),
            strokeWidth: c.down('#borderWidth').getValue(),
            color: color,
            fill: fill
        }),
        success: function(res) {
            console.log('Successfuly saved');
            if (cb) cb(res);
        }
    });
}

function openTerminal(id) {
    Ext.Ajax.request({
        method: 'GET',
        url: '/rest/device/'+id,
        success: function(res) {
            var obj=Ext.JSON.decode(res.responseText);
            if (obj && obj.fullType && obj.fullType.iouBin ) {
                if (obj.fullType.iouBin.type=='qemu') {
                  window.open('vnc.html#'+id,'VNC'+id,"location=0,status=0,scrollbars=0,width=800,height=600");
                } else {
                  window.open('terminal.html#'+id,'Terminal'+id,"location=0,status=0,scrollbars=0,width=800,height=600");                    
                }
            }
        }
    });
}
