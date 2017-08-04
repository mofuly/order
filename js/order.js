var dishes,
    dishTypes = [],
    uid,
    tableID,
    ws,
    ps = ['大份', '中份', '小份'],
    currentPageTypeID,
    dataGened = false,
    orderGot = false,
    wsConnected = false;

function getTableID() {

    var url = window.location.search;
    if (url.indexOf("?") != -1) {
        var str = url.substr(1)
        strs = str.split("&");
        var key = new Array(strs.length);
        var value = new Array(strs.length);
        for (i = 0; i < strs.length; i++) {
            key[i] = strs[i].split("=")[0]
            value[i] = unescape(strs[i].split("=")[1]);
            if (key[i] === 'id') return value[i];
        }
    }
    return '';
}

function load() {
    if (urlBase.indexOf('//') > 0) {
        ws = new WebSocket('ws:' + urlBase.substr(urlBase.indexOf('//'), urlBase.length));
    } else {
        ws = new WebSocket('ws:' + urlBase);
    }
    uid = uuid();
    tableID = getTableID();
    if (!tableID) {
        alert('桌号错误');
        return;
    }

    post(urlBase + 'getTableName', {
        tableID: tableID
    }, function (data) {
        document.title += '--' + data.tableName;
    });

    post(urlBase + 'getDishList', {
        tableID: tableID
    }, function (data) {
        dishes = data;
        genData();
    });


    ws.onmessage = function (e) {
        var data = JSON.parse(e.data);
        if (data.command === 'orderIt' && data.tableID === tableID) {
            if (!data.succeed) {
                myApp.hideIndicator();
                myApp.alert('下单失败：' + JSON.stringify(data.error));
                return;
            }
            for (var i = 0; i < dishes.length; i++) {
                for (var j = 0; j < dishes[i].price.length; j++) {
                    dishes[i].price[j].count = 0;
                }
                displayTotal(i, dishes[i].price[0].priceSort);
            }
            toggleOrderDetailPage();
            myApp.hideIndicator();
            myApp.alert('下单成功,请等待确认......');
        }
        if (data.command === 'emptyIt' && data.tableID === tableID) {
            if (!data.succeed) {
                myApp.hideIndicator();
                myApp.alert('清空失败：' + data.error);
                return;
            }
            for (var i = 0; i < dishes.length; i++) {
                for (var j = 0; j < dishes[i].price.length; j++) {
                    dishes[i].price[j].count = 0;
                }
                displayTotal(i, dishes[i].price[0].priceSort);
            }
            toggleOrderDetailPage();
            myApp.hideIndicator();
            myApp.alert('清空成功');
        }
        if (data.command === 'returnOrders' && data.to === uid && data.tableID === tableID) {
            for (var i = 0; i < data.data.length; i++) {
                orderChange(data.data[i].dishID, data.data[i].priceSort, false);
            }
            myApp.hideIndicator();
            showPage(currentPageTypeID);
            orderGot = true;
        }
        if (data.command === 'orderChange' && data.from !== uid && data.tableID === tableID) {
            orderChange(data.dishID, data.priceSort, false);
            myApp.hideIndicator();
        }
        if (data.command === 'callWaitress' && data.tableID === tableID) {
            if (data.succeed) {
                myApp.alert('服务员已应答,请稍候......');
            } else {
                myApp.alert('呼叫服务员失败,请稍后再呼......');
            }
        }
    };
    ws.onopen = function () {
        wsConnected = true;
        if (dataGened && !orderGot) {
            ws.send(JSON.stringify({
                command: 'getOrders',
                uid: uid,
                tableID: tableID
            }));
        }
    };
}

function redraw(orderID) {
    myApp.confirm('确定要撤销吗?', function () {
        post(urlBase + '/redraw', {
            orderID: orderID
        }, function (data) {
            myApp.alert(data[0]['f_redrawOrder(' + orderID + ')'], function () {
                document.getElementById('page_displayOrder').setAttribute('hidden', true);
            });
        });
    });
}

function priceSortNameByDishID(dishID, priceSort) {
    var dIndex = getDishIndex(dishID);

    if (dIndex < 1) return '';
    if (dishes[dIndex].price.length < 2) return '';
    return '(' + ps[priceSort] + ')';
}

function displayOrders() {
    post(urlBase + 'displayOrders', {
        tableID: tableID
    }, function (data) {
        var orderID = 0,
            html = [],
            seq = 1,
            d, elem,
            count = 0,
            fee = 0,
            tailUnconfirm = '',
            tailConfirmed;
        if (data.length < 1) {
            myApp.alert('您还没有订单！');
            return;
        }
        myApp.showIndicator();
        tailUnconfirm = '<tr><td colspan=2><a class="button button-round active" href="#" onclick="redraw(@@);">撤销订单</a><td>合计</td><td class="number">';
        tailConfirm = '<tr><td colspan=2><a class="button button-round active" href="#" onclick="redraw(@@);">申请撤销</a><td>合计</td><td class="number">';
        for (var i = 0; i < data.length; i++) {
            if (orderID !== data[i].ordersID) {
                if (i > 0) {
                    if (data[i].orderStatus > 0) {
                        html.push(tailConfirm.replace(/@@/, data[i].ordersID));
                    } else {
                        html.push(tailUnconfirm.replace(/@@/, data[i].ordersID));
                    }
                    html.push(count);
                    html.push('</td><td class="number">');
                    html.push(fee);
                    html.push('</td></tr></table><br />');
                    seq = 1;
                }
                count = 0;
                fee = 0;
                orderID = data[i].ordersID;
                html.push('订单号:');
                html.push(data[i].ordersID);
                if (data[i].orderStatus > 0) {
                    html.push('<span style="color:red">已确认</span>');
                } else {
                    html.push('<span style="color:red">未确认</span>');
                }
                html.push('下单时间:');
                html.push(data[i].orderDate);
                html.push('<br />');
                html.push('<table class="tableMenu" border="1" width="100%"><tr><td width="13%">序号</td><td width="40%">菜名</td><td width="14%">单价</td><td width="13%">数量</td><td>小计</td></tr>');
            }
            count += data[i].counts;
            fee += data[i].price * data[i].counts;
            html.push('<tr><td class="number">');
            html.push(seq++);
            html.push('</td><td>');
            html.push(data[i].dishName + priceSortNameByDishID(data[i].dishID, data[i].priceSort));
            html.push('</td><td class="number">');
            html.push(data[i].price);
            html.push('</td><td class="number">');
            html.push(data[i].counts);
            html.push('</td><td class="number">');
            html.push(data[i].price * data[i].counts);
            html.push('</td></tr>');
        }
        if (data[data.length - 1].orderStatus > 0) {
            html.push(tailConfirm.replace(/@@/, data[data.length - 1].ordersID));
        } else {
            html.push(tailUnconfirm.replace(/@@/, data[data.length - 1].ordersID));
        }
        html.push(count);
        html.push('</td><td class="number">');
        html.push(fee);
        html.push('</td></tr></table><br />');
        elem = document.getElementById('displayOrderList');
        elem.innerHTML = html.join('\n');
        elem = document.getElementById('page_displayOrder');
        elem.removeAttribute('hidden');
        myApp.hideIndicator();
    });
}
/* 在dishes[]中查找dishID,返回下标 index,没找到返回-1 */
function getDishIndex(dishID) {
    for (var i = 0; i < dishes.length; i++) {
        if (dishes[i].dishID === dishID) return i;
    }
    return -1;
}

function mustOrder() {
    var i = 0,
        j,
        optTypes = [],
        inIt = true;

    for (; i < dishes.length; i++) {

        if (dishes[i].mustOrder === 2 && getDishOrderCountByIndex(i) < 1) { // 全单必选项
            return '【' + dishes[i].typeName + '】中的【' + dishes[i].dishName + '】为必选,请选择！';
        }
    }

    for (i = 0; i < dishes.length; i++) {
        if (dishes[i].mustOrder == 1) {
            if (optTypes.indexOf(dishes[i].typeID) < 0) optTypes.push(dishes[i].typeID);
        }
    }

    for (i = 0; i < dishes.length; i++) {
        inIt = true;
        if (getDishOrderCountByIndex(i) > 0 && dishes[i].mustOrder === 0) {
            inIt = false;
            if (optTypes.indexOf(dishes[i].typeID) >= 0) {
                inIt = dishes.some(function (value, index) {
                    return getDishOrderCountByIndex(index) > 0 && dishes[i].typeID === value.typeID && value.mustOrder === 1;
                });
                if (!inIt) return '【' + dishes[i].typeName + '】中选了【' + dishes[i].dishName + '】但是没选必选项';
            }
        }
    }

    return '';
}

function callWaitress() {
    myApp.confirm('确定要呼叫服务员吗?', function () {
            ws.send(JSON.stringify({
                command: 'callWaitress',
                uid: uid,
                tableID: tableID
            }));
        },
        function () {
            return;
        });
}

function emptyIt() {
    myApp.confirm('确定要清空吗?', function () {
            myApp.showIndicator();
            ws.send(JSON.stringify({
                command: 'emptyIt',
                uid: uid,
                tableID: tableID
            }));
        },
        function () {
            return;
        });
}

function orderIt() {
    var m = '';

    m = mustOrder();
    if (m !== '') {
        myApp.alert(m);
        return;
    }
    myApp.showIndicator();
    ws.send(JSON.stringify({
        command: 'orderIt',
        uid: uid,
        tableID: tableID
    }));
}

function toggleOrderDetailPage() {
    var elem,
        i = 0,
        total = 0,
        count = 0,
        html,
        seq = 0;

    elem = document.getElementById('page_orderDetail');

    if (elem.hasAttribute('hidden')) {
        if (dishes.length < 1) {
            return;
        }
        html = '<table class="tableMenu" width="100%" border="1"><tr><td width="12%">序号</td><td width="50%">菜名</td><td width="12%">单价</td><td width="12%">数量</td><td>小计</td></tr>';
        for (; i < dishes.length; i++) {
            for (var j = 0; j < dishes[i].price.length; j++) {
                if (dishes[i].price[j].count < 1) continue;
                html += '<tr><td class="number">' + (++seq) + '</td><td>' + dishes[i].dishName;
                if (dishes[i].price.length > 1) {
                    html += '(' + ps[dishes[i].price[j].priceSort] + ')';
                }
                html += '</td><td class="number">';
                html += dishes[i].price[j].priceAfterDiscount + '</td><td class="number">';
                html += dishes[i].price[j].count + '</td><td class="number">';
                html += dishes[i].price[j].count * dishes[i].price[j].priceAfterDiscount + '</td></tr>';
                total += dishes[i].price[j].count * dishes[i].price[j].priceAfterDiscount;
                count += dishes[i].price[j].count;
            }
        }
        html += '<tr><td colspan="3" style="margin-right:0">合计</td><td class="number">';
        html += count + '</td><td class="number">' + total + '</td></tr></table>';
        if (total > 0) {
            elem.removeAttribute('hidden');
            elem = document.getElementById('orderdDishesList');
            elem.innerHTML = html;
        } else {
            return;
        }
    } else {
        elem.setAttribute('hidden', 'true');
    }
}

function typeNameByTypeID(typeID) {
    for (var i = 0; i < dishes.length; i++) {
        if (dishes[i].typeID === typeID) return dishes[i].typeName;
    }
    return '';
}

function showPage(typeID) {
    var pages, i, j, el, typeName, count = 0;

    currentPageTypeID = typeID;
    pages = document.getElementsByClassName('dishPage');
    el = document.getElementById('dishTypeMenu');
    for (i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page_' + typeID) {
            pages[i].style.display = 'block';
        } else {
            pages[i].style.display = 'none';
        }
    }
    for (i = 0; i < dishes.length; i++) {
        if (dishes[i].typeID === typeID) {
            typeName = dishes[i].typeName;
            for (j = 0; j < dishes[i].price.length; j++) {
                count += dishes[i].price[j].count;
            }
        }
    }
    if (count > 0) {
        el.innerHTML = typeName + '<sup style="color:red">' + count + '</sup>';
    } else {
        el.innerHTML = typeName;
    }
}

/* 显示点菜的数量和总价,参数dIndex为dishes[]的下标 */
function displayTotal(dIndex, ps) {
    var typeID, count = 0;
    var totalCount = 0,
        totalFee = 0,
        dc;

    showDishCount(dIndex, ps);
    typeID = dishes[dIndex].typeID;
    for (i = 0; i < dishes.length; i++) {
        dc = getDishOrderCountByDishID(dishes[i].dishID);
        if (dishes[i].typeID === typeID) {
            count += dc;
        }
        totalCount += dc;
        for (var j = 0; j < dishes[i].price.length; j++) {
            totalFee += dishes[i].price[j].priceAfterDiscount * dishes[i].price[j].count;
        }
    }
    elemID = 'toolBar_badge_' + typeID;
    elem = document.getElementById(elemID);
    if (count > 0) {
        elem.innerHTML = '<span class="badge bg-red">' + count + '</span>';
        if (typeID === currentPageTypeID) {
            document.getElementById('dishTypeMenu').innerHTML = typeNameByTypeID(currentPageTypeID) + '<sup style="color:red">' + count + '</sup>';
        }
    } else {
        elem.innerHTML = '';
        if (typeID === currentPageTypeID) {
            document.getElementById('dishTypeMenu').innerHTML = typeNameByTypeID(currentPageTypeID);
        }
    }
    elemID = 'orderMenu';
    elem = document.getElementById(elemID);
    if (totalCount > 0) {
        elem.innerHTML = '下单<sub style="color:red">▼</sub><sup style="color:red">' + totalCount + '</sup>';
    } else {
        elem.innerHTML = '下单';
    }
    elemID = 'serviceMenu';
    elem = document.getElementById(elemID);
    if (totalFee > 0) {
        elem.innerHTML = '服务<sup style="color:red">￥' + totalFee + '</sup><sub style="color:red">▼</sub>';
    } else {
        elem.innerHTML = '服务<sub style="color:red">▼</sub>';
    }
}


/* 显示被点菜的数量 dIndex 为dishes[]下标*/
function showDishCount(dIndex, ps) {
    var elemDecrease, elemCount, elemID, count, i, el;

    elemID = 'decreaseDish_' + dishes[dIndex].dishID;
    elemDecrease = document.getElementById(elemID);
    elemID = 'dishCount_' + dishes[dIndex].dishID;
    elemCount = document.getElementById(elemID);

    count = getDishOrderCountByIndex(dIndex);

    if (count < 1) {
        if (dishes[dIndex].price[indexOfPriceSort(dIndex, ps)].count < 1) {
            elemDecrease.setAttribute('hidden', 'true');
            elemCount.setAttribute('hidden', 'true');
        } else {
            elemDecrease.removeAttribute('hidden');
            elemCount.removeAttribute('hidden');
            elemCount.innerHTML = count;
        }
    } else {
        if (dishes[dIndex].price[indexOfPriceSort(dIndex, ps)].count < 1) {
            elemDecrease.setAttribute('hidden', 'true');
            elemCount.innerHTML = count;
        } else {
            if (dishes[dIndex].price[indexOfCurrentPriceSort(dIndex)].count < 1) {
                elemDecrease.setAttribute('hidden', true);
            } else {
                elemDecrease.removeAttribute('hidden');
            }
            elemCount.removeAttribute('hidden');
            elemCount.innerHTML = count;
        }
    }
    if (dishes[dIndex].price.length > 1) {
        for (i = 0; i < dishes[dIndex].price.length; i++) {
            el = document.getElementById('priceBadge_' + dishes[dIndex].dishID + '_' + dishes[dIndex].price[i].priceSort);
            if (dishes[dIndex].price[i].count > 0) {
                el.innerHTML = '<sub>' + dishes[dIndex].price[i].count + '</sub>';
            } else {
                el.innerHTML = '';
            }
        }
    }
}

function getDishOrderCountByDishID(dishID) {
    var dIndex = getDishIndex(dishID);

    return getDishOrderCountByIndex(dIndex);
}

function getDishOrderCountByIndex(dIndex) {
    var count = 0,
        i;

    for (i = 0; i < dishes[dIndex].price.length; i++) {
        count += dishes[dIndex].price[i].count;
    }

    return count;
}

function orderChange(dishID, priceSort, isLocal) {
    var changeCount = 1;
    var dIndex;
    var elem, elemID;
    var psIndex;

    if (dishID < 0) changeCount = -1;
    dishID = Math.abs(dishID);

    dIndex = getDishIndex(dishID);
    psIndex = indexOfPriceSort(dIndex, priceSort);
    dishes[dIndex].price[psIndex].count += changeCount;
    displayTotal(dIndex, priceSort);
    if (isLocal) {
        data = JSON.stringify({
            command: 'orderChange',
            uid: uid,
            tableID: tableID,
            dishID: dishID * changeCount,
            price: dishes[dIndex].price[psIndex].priceAfterDiscount,
            priceSort: priceSort
        });
        ws.send(data);
    }
}

function typeStars(typeID) {
    var starts = 0,
        s = '';
    for (var i = 0; i < dishes.length; i++) {
        if (dishes[i].typeID === typeID) {
            starts = Math.max(starts, dishes[i].mustOrder);
        }
    }

    if (starts < 1) return '';

    for (var i = 0; i < starts; i++) {
        s += '*';
    }
    return '<span style="color:red">' + s + '</span>';
}

function showImage(id) {
    var elem = document.getElementById('dishImage_' + id),
        page = document.getElementById('page_image'),
        img = document.getElementById('dishImage'),
        desc = document.getElementById('dishDescription_' + id);

    document.getElementById('description').innerHTML = desc.innerHTML;
    img.setAttribute('src', elem.getAttribute('src'));
    page.removeAttribute('hidden');
}

function indexOfPriceSort(dIndex, ps) {
    for (var i = 0; i < dishes[dIndex].price.length; i++) {
        if (dishes[dIndex].price[i].priceSort === ps) {
            return i;
        }
    }
    return -1;
}

function indexOfCurrentPriceSort(dIndex) {
    for (var i = 0; i < dishes[dIndex].price.length; i++) {
        if (dishes[dIndex].currentPriceSort === dishes[dIndex].price[i].priceSort) {
            return i;
        }
    }
    return -1;
}

function priceClick(dishID, priceSort) {
    var el, di, at, ct = '';

    di = getDishIndex(dishID);
    dishes[di].currentPriceSort = priceSort;
    for (var i = 0; i < dishes[di].price.length; i++) {
        el = document.getElementById('price_' + dishID + '_' + dishes[di].price[i].priceSort);
        at = el.getAttribute('class');
        at = at.replace(/color-red/g, '');
        at = at.replace(/color-blue/g, '');
        if (dishes[di].price[i].priceSort === priceSort) {
            el.setAttribute('class', at.replace(/^\s+|\s+$/gm, '') + ' color-red');
        } else {
            el.setAttribute('class', at.replace(/^\s+|\s+$/gm, '') + ' color-blue');
        }
    }
    el = document.getElementById('dishPrice_' + dishID);
    if (dishes[di].discount !== 10) {
        ct += '<del>￥' + dishes[di].price[indexOfCurrentPriceSort(di)].price + '元</del>';
    } else {
        ct += '￥' + dishes[di].price[indexOfCurrentPriceSort(di)].priceAfterDiscount + '元';
    }
    el.innerHTML = ct;

    el = document.getElementById('dishPriceAfterDiscount_' + dishes[di].dishID);

    if (dishes[di].discount !== 10) {
        content += '￥' + dishes[di].price[indexOfCurrentPriceSort(di)].priceAfterDiscount + '元';
    }
    showDishCount(di, priceSort);
}

function genData() {
    var toolBar = '',
        content = '',
        i, j,
        currTypeID = 0,
        elem;

    for (i = 0; i < dishes.length; i++) {
        if (currTypeID !== dishes[i].typeID) {
            currTypeID = dishes[i].typeID;
            dishTypes.push(currTypeID);
            toolBar += '<p><a href="#" class="close-panel" onclick="showPage(' + currTypeID + ')">' + dishes[i].typeName + typeStars(currTypeID);
            toolBar += '<span id="toolBar_badge_' + currTypeID + '"></span></a></p>';
            if (content === '') {
                content = '<div id="page_' + currTypeID + '" data-page="page_' + currTypeID + '" class="page dishPage">\n';
            } else {
                content += ' </table>\n</div>\n</div>\n<div id="page_' + currTypeID + '" class = "page cached dishPage" data-page="page_' + currTypeID + '">\n';
            }
            content += '<div class="page-content">\n<table id="tableContent' + currTypeID;
            content += '" width="100%" style="font-size:1.2rem;margin-top:3rem">\n';
            content += '<div>\n<a name="dishList_' + currTypeID + '" id="dishList_' + currTypeID + '"></a>\n<tr ';
        } else {
            content += '<div>\n<tr ';
        }
        content += 'style="margin:0;padding:0" border=1>\n<td width="40%" style="margin:0;padding:0">\n';
        content += '<img src="image/' + dishes[i].imageFile + '" width="100%" style="margin:0;padding:0" ';
        content += 'onclick="showImage(' + dishes[i].dishID + ');" id="dishImage_' + dishes[i].dishID + '"></img>\n';
        content += '</td>\n<td>\n<table width="100%">\n<tr>\n<td id="dishName_' + dishes[i].dishID + '">';
        content += dishes[i].dishName + typeStars(dishes[i].typeID);
        content += '</td>\n</tr>\n<tr>\n<td id="dishPrice_' + dishes[i].dishID + '">';
        if (dishes[i].discount !== 10) {
            content += '<del>￥' + dishes[i].price[0].price + '元</del></td>\n';
        } else {
            content += '￥' + dishes[i].price[0].priceAfterDiscount + '元</td>\n';
        }
        content += '</tr>\n<tr>\n<td id="dishPriceAfterDiscount_' + dishes[i].dishID + '">\n';

        if (dishes[i].discount !== 10) {
            content += '￥' + dishes[i].price[0].priceAfterDiscount + '元\n';
        }
        content += '</td>\n</tr>\n';
        dishes[i].currentPriceSort = dishes[i].price[0].priceSort;
        if (dishes[i].priceSorts > 1) {
            content += '<tr><td><div class="buttons-row">';
            for (j = 0; j < dishes[i].price.length; j++) {
                content += '<a href="#" id="price_' + dishes[i].dishID + '_' + dishes[i].price[j].priceSort + '" class="button button-primary';
                if (j === 0) content += ' color-red';
                content += '" onclick="priceClick(' + dishes[i].dishID + ',' + dishes[i].price[j].priceSort + ');">' + ps[dishes[i].price[j].priceSort];
                content += '<span style="font-color:red" id="priceBadge_' + dishes[i].dishID + '_' + dishes[i].price[j].priceSort + '"></span></a>';
            }
            content += '</div></td></tr>';
        }
        content += '<tr>\n<td style="color:red;font-size:2.5rem;text-align:right">\n';
        content += '<a id="decreaseDish_' + dishes[i].dishID + '" ';
        content += 'onclick="orderChange(-' + dishes[i].dishID + ',dishes[' + i + '].currentPriceSort';
        content += ',true);" hidden>-</a>\n<span id="dishCount_';
        content += dishes[i].dishID + '" hidden>0</span>\n<a id="plusDish_' + dishes[i].dishID;
        content += '" onclick="orderChange(';
        content += dishes[i].dishID + ',dishes[' + i + '].currentPriceSort,true)';
        content += ';">\n+\n</a>\n</td>\n</tr>\n</table>\n</td>\n</tr>\n<tr>\n<td colspan="2" id="dishDescription_';
        content += dishes[i].dishID;
        content += '">\n' + dishes[i].description + '</td>\n</tr>\n</div>\n';
    }
    content += '</table></div></div>';
    elem = document.getElementById('leftSideMenu');
    elem.innerHTML += toolBar;
    elem = document.getElementById('pages');
    elem.innerHTML += content;
    currentPageTypeID = dishes[0].typeID;
    dataGened = true;
    if (wsConnected && !orderGot) {
        ws.send(JSON.stringify({
            command: 'getOrders',
            uid: uid,
            tableID: tableID
        }));
    }

}
