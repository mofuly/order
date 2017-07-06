/* 封装ajax函数
 * @param {string}opt.type http连接的方式，包括POST和GET两种方式，默认使用GET
 * @param {string}opt.url 发送请求的url
 * @param {boolean}opt.async 是否为异步请求，true为异步的，false为同步的
 * @param {object}opt.data 发送的参数，格式为对象类型
 * @param {function}opt.success ajax发送并接收成功调用的回调函数
 */
// 使用示例
/*ajax({
    method: 'POST',
    url: 'test.php',
    data: {
        name1: 'value1',
        name2: 'value2'
    },
    success: function (response) {
        // codes here
    }
});*/
function ajax(opt) {　　
    opt = opt || {};

    var type = opt.method || 'GET';　　
    type = type.toUpperCase() || 'GET';　　
    var url = opt.url || '';　　
    var async = opt.async || true;　　
    var data = opt.data || null;　　
    var success = opt.success || function() {};　　
    var xmlHttp = null;　　
    if (XMLHttpRequest) {　　　　 xmlHttp = new XMLHttpRequest();　　 }　　
    else {　　　　 xmlHttp = new ActiveXObject('Microsoft.XMLHTTP');　　 }　　
    var params = [];　　
    for (var key in data) {　　　　 params.push(key + '=' + data[key]);　　 }　　
    var dataStr = params.join('&');　　
    if (type === 'POST') {　　　　
        xmlHttp.open(type, url, async);　　　　
        xmlHttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=utf-8');　　　　
        xmlHttp.send(dataStr);　　
    }　　
    else {　　　　
        xmlHttp.open(type, url + '?' + dataStr, async);　　　　
        xmlHttp.send(null);　　
    }　　
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            success(JSON.parse(xmlHttp.responseText));
        }
    };
}