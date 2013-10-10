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
          window.open('terminal.html#'+obj.oMsg.id,'Terminal'+obj.oMsg.id,"location=0,status=0,scrollbars=0,width=650,height=400");
          hideTip();
        };
    });
    th=setTimeout(function(){
        t.showAt([objModel.clientX+15,objModel.clientY+15]);
    },300);
}

