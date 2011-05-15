// ==UserScript==
// @name           bro3_graph
// @version        1.06
// @namespace      http://blog.livedoor.jp/froo/
// @include        http://*.3gokushi.jp/alliance/list.php*
// @include        http://*.1kibaku.jp/alliance/list.php*
// @description    ブラウザ三国志 統計グラフ化ツール by 浮浪プログラマ
// ==/UserScript==

// 公開ページ: http://blog.livedoor.jp/froo/archives/51416669.html
// 使い方: 「統計」-「同盟」ページ検索欄横の各リンクをクリック

var VERSION = "1.06";
var LOCAL_STORAGE = "bro3_graph";

var DELIMIT = "#$%";
var DELIMIT2 = "&?@";
var GRAPH_WIDTH = 745;
var GRAPH_HEIGHT = 500;
var GRAPH_PADDING = 8;

//色定義
var ALLY_COLORS = new Array("blue", "red", "green", "olive", "brown", 
	"purple", "black", "indigo", "deeppink", "darkcyan", 
	"dodgerblue", "lightcoral", "lawngreen", "yellow", "tomato", 
	"plum", "darkgray", "mediumpurple", "pink", "cyan");

//保存データインデックス
var IDX_DATETIME = 0; //日時
var IDX_POINT = 1; //ポイント
var IDX_RANK = 2; //ランク
var IDX_MEMBER = 3; //メンバー
//var IDX_LEADER = 4; //盟主

//グローバル変数
var TOOL_LOADED = false;
var ALLYS = new Array(); //入力同盟名
var CURRENT_ALLYS = new Array();
var ALLYS_INDEX = new Array(); //同盟インデックス

//main
(function(){
	
	//mixi鯖障害回避用: 広告iframe内で呼び出されたら無視
	var container = document.evaluate('//*[@id="container"]',
		document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	if (container.snapshotLength == 0) return;
	
	initGMWrapper();
	var allysIndexTmp = GM_getValue(location.hostname + "_allys_index", "");
	if (allysIndexTmp != "") ALLYS_INDEX = allysIndexTmp.split(DELIMIT);
	getAllyData();
	addLinkHtml();
})();

//同盟ランキングデータ取得
function getAllyData() {
	var tableElems = document.evaluate(
		'//*[@id="grayWrapper"]//table/tbody/tr',
		document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	
	//ランキング時刻を取得
	var time = getChildElement(
		getChildElement(tableElems.snapshotItem(0), 2), 0).innerHTML;
	time = time.replace(/^([0-9]{2}:[0-9]{2}).+$/, "$1");
	var now = new Date();
	var nowTime = padZero(now.getHours()) + ":" + padZero(now.getMinutes());
	
	//前日分かチェック
	var tmpDate = now;
	if (nowTime < time) {
		tmpDate.setDate(now.getDate() - 1);
	}
	
	//日時に編集
	var datetime = tmpDate.getFullYear() + "/" + padZero(tmpDate.getMonth() + 1) + 
		"/" + padZero(tmpDate.getDate()) + " " + time;
	
	//各同盟データ取得
	CURRENT_ALLYS = new Array();
	for (var i = 2; i<tableElems.snapshotLength; i++) {
		var item = tableElems.snapshotItem(i);
		var appendData = new Array();
		appendData[IDX_DATETIME] = datetime;
		
		//更新データ取得
		var name = getChildElement(getChildElement(item, 1), 0).innerHTML; //同盟略称
		appendData[IDX_POINT] = getChildElement(item, 2).innerHTML; //ポイント
		appendData[IDX_RANK] = getChildElement(item, 0).innerHTML.replace(/→\s/, ""); //ランク
		appendData[IDX_MEMBER] = getChildElement(item, 3).innerHTML; //メンバー
		CURRENT_ALLYS.push(name);
		
		//既存データを取得
		var data = loadAllyData(name);
		
		//データ更新
		var upIdx = data.length;
		if (data.length >= 1) {
			var lastDatetime = data[data.length-1][0];
			if (datetime == lastDatetime) {
				upIdx--;
			}
		}
		data[upIdx] = appendData;
		
		//Greasemonkey領域へ永続保存
		saveAllyData(name, data);
		
		//検索用索引更新
		if (searchArrayItem(ALLYS_INDEX, name) < 0) {
			ALLYS_INDEX.push(name);
		}
	}
	
	//検索用索引をGreasemonkey領域へ永続保存
	saveAllysIndex();
}

//ツールOpenリンク追加
function addLinkHtml() {
	var containerElem = document.getElementById("rankSearch");
	var addElem = document.createElement("span");
	containerElem.appendChild(addElem);
	addElem.id = "toolLink";
	
	//aタグ（グラフ）
	var linkGraph =  document.createElement("a");
	linkGraph.id = "toolOpen";
	linkGraph.href = "javascript:void(0);";
	linkGraph.innerHTML = "グラフ表示";
	linkGraph.style.color = "white";
	linkGraph.style.backgroundColor = "black";
	linkGraph.style.padding = "3px 5px";
	linkGraph.style.margin = "2px 4px";
//	linkGraph.style.textDecoration = "underline";
	linkGraph.addEventListener("click", function() {openTool();}, true);
	addElem.appendChild(linkGraph);
	
	//aタグ（CSV）
	var linkCsv =  document.createElement("a");
	linkCsv.id = "toolCsv";
	linkCsv.href = "javascript:void(0);";
	linkCsv.innerHTML = "CSV表示";
	linkCsv.style.color = "white";
	linkCsv.style.backgroundColor = "black";
	linkCsv.style.padding = "3px 5px";
	linkCsv.style.margin = "2px 4px";
	linkCsv.addEventListener("click", function() {outputCsv();}, true);
	addElem.appendChild(linkCsv);
}

//ツールOpen
function openTool() {
	
	//既存オブジェクト消去
	document.getElementById("grayWrapper").style.display = "none";
	
	//グラフオブジェクト表示
	if (TOOL_LOADED) {
		document.getElementById("graphtool").style.display = "block";
	} else {
		addToolHtml(document.getElementById("whiteWrapper"));
		TOOL_LOADED = true;
	}
}

//ツールHTML追加
function addToolHtml(parentElem) {
	
	//グラフオブジェクト追加
	var toolElem = document.createElement("div");
	parentElem.appendChild(toolElem);
	toolElem.id = "graphtool";
	toolElem.style.margin = "8px 8px";
	
	//グラフ化対象同盟取得
	loadTargetAllys();
	
	//HTML追加
	addGraphHtml(toolElem);
	addCtrlHtml(toolElem);
	if (navigator.userAgent.toLowerCase().indexOf('chrome') < 0) {
		initPopup(toolElem);
	}
}

//グラフ部HTML追加
function addGraphHtml(parentElem) {
	var graphElem = document.createElement("div");
	parentElem.insertBefore(graphElem, document.getElementById("graphCtrl"));
	graphElem.id = "graphMain";
	graphElem.style.position = "relative";
	
	var canvasHtml = "<canvas id='graphCanvas' " +
		"width='" + (GRAPH_WIDTH + GRAPH_PADDING * 2) + 
		"' height='" + (GRAPH_HEIGHT + GRAPH_PADDING * 2) + "'></canvas>";
	graphElem.innerHTML = canvasHtml;
	var canvas = document.getElementById("graphCanvas");
	canvas.style.backgroundColor = "gainsboro";
	var ctx = canvas.getContext("2d");
	
	//時間がかかるので別スレッド化（一旦描画して砂時計を表示させる）
	setWaitCursor();
	window.setTimeout(function() {
		
		//同盟データ取得
		var allysData = new Array();
		var maxDatetime = new Date("2000/1/1 00:00:00");
		var minDatetime = new Date("2099/12/31 23:59:59");
		var maxPoint = 0;
//		var minPoint = 999999999;
		var minPoint = 0;
		for (var i = 0; i < ALLYS.length; i++) {
			if (ALLYS[i] == "") continue;
			var srcData = loadAllyData(ALLYS[i]);
			if (srcData.length == 0) continue;
			
			allysData[i] = new Array();
			for (var j = 0; j < srcData.length; j++) {
				allysData[i][j] = new Array();
				var datetime = new Date(srcData[j][IDX_DATETIME]);
				var point = parseInt(srcData[j][IDX_POINT]);
				if (isNaN(point)) point = 0;
				
				//最大/最小値チェック
				if (datetime.getTime() > maxDatetime.getTime()) maxDatetime = datetime;
				if (datetime.getTime() < minDatetime.getTime()) minDatetime = datetime;
				if (point > maxPoint) maxPoint = point;
//				if (point < minPoint) minPoint = point;
				
				allysData[i][j][IDX_DATETIME] = datetime;
				allysData[i][j][IDX_POINT] = point;
			}
		}
		
		//グラフ表示
		for (var i = allysData.length - 1; i >= 0; i--) {
			if (allysData[i] == undefined) continue;
			ctx.strokeStyle = ALLY_COLORS[i];
			ctx.beginPath();
			
			var isFirst = true;
			for (var j = 0; j < allysData[i].length; j++) {
				if (allysData[i][j] == undefined) continue;
				var datetime = allysData[i][j][IDX_DATETIME];
				var point = allysData[i][j][IDX_POINT];
				
				var xRatio = 0;
				if (maxDatetime.getTime() > minDatetime.getTime()) { 
					 xRatio = (datetime.getTime() - minDatetime.getTime()) 
						/ (maxDatetime.getTime() - minDatetime.getTime());
				}
				
				var yRatio = 0;
				if (maxPoint > minPoint) {
					yRatio = (point - minPoint) / (maxPoint - minPoint);
				}
				
				var xPos = Math.floor(GRAPH_WIDTH * xRatio) + GRAPH_PADDING;
				var yPos = GRAPH_HEIGHT - Math.floor(GRAPH_HEIGHT * yRatio) + GRAPH_PADDING;
				
				if (isFirst) ctx.moveTo(xPos, yPos);
				else ctx.lineTo(xPos, yPos);
				isFirst = false;
				
				var mark = document.createElement("div");
				graphElem.appendChild(mark);
				mark.style.position = "absolute";
				mark.style.border = "outset 1px " + ALLY_COLORS[i];
				mark.style.backgroundColor = ALLY_COLORS[i];
				mark.style.width = "6px";
				mark.style.height = "6px";
				mark.style.left = (xPos - 4) + "px";
				mark.style.top = (yPos - 4) + "px";
				
				//ポップアップ設定
				var popupText = ALLYS[i] + "<br/>" + generateDateString(datetime) + 
					"<br/> " + point + "ポイント";
				if (navigator.userAgent.toLowerCase().indexOf('chrome') >= 0) {
					mark.title = popupText.replace(/<br\/>/g, "\n");
				} else {
					mark.addEventListener("mouseover", createOnPopup(popupText), true);
					mark.addEventListener("mouseout", function() {offPopup();}, true);
				}
			}
			
			ctx.stroke();
		}
		
		resetCursor();
	}, 0);
}

//操作部HTML追加
function addCtrlHtml(parentElem) {
	var addElem = document.createElement("div");
	parentElem.appendChild(addElem);
	addElem.id = "graphCtrl";
	addElem.style.margin = "2px 2px";

	addElem.innerHTML = 
		"<table style='font-size:11px'>"+
		"<tr>"+
			"<td style='background-color:black; padding:5px 4px; text-align:center;'>"+
				"<a id='graphtoolClose' href='javascript:void(0);'>ランキング</a>"+
			"</td>"+
			"<td style='width:5px'></td>"+
			"<td id='fld_ally1' style='padding:2px 4px;'>"+
				"<input id='ally1' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally2' style='padding:2px 4px;'>"+
				"<input id='ally2' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally3' style='padding:2px 4px;'>"+
				"<input id='ally3' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally4' style='padding:2px 4px;'>"+
				"<input id='ally4' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally5' style='padding:2px 4px;'>"+
				"<input id='ally5' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally6' style='padding:2px 4px;'>"+
				"<input id='ally6' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally7' style='padding:2px 4px;'>"+
				"<input id='ally7' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally8' style='padding:2px 4px;'>"+
				"<input id='ally8' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally9' style='padding:2px 4px;'>"+
				"<input id='ally9' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally10' style='padding:2px 4px;'>"+
				"<input id='ally10' type='text' style='width:52px' />"+
			"</td>"+
			"<td style='background-color:black; padding:0px 4px; text-align:center;'>"+
				"<input id='graphtoolSave' type='button' value='保存' />"+
			"</td>"+
		"</tr>"+
		"<tr>"+
			"<td id='version' "+
				"style='font-size:9px; padding:2px 2px; text-align:center;'></td>"+
			"<td></td>"+
			"<td id='fld_ally11' style='padding:2px 4px;'>"+
				"<input id='ally11' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally12' style='padding:2px 4px;'>"+
				"<input id='ally12' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally13' style='padding:2px 4px;'>"+
				"<input id='ally13' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally14' style='padding:2px 4px;'>"+
				"<input id='ally14' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally15' style='padding:2px 4px;'>"+
				"<input id='ally15' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally16' style='padding:2px 4px;'>"+
				"<input id='ally16' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally17' style='padding:2px 4px;'>"+
				"<input id='ally17' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally18' style='padding:2px 4px;'>"+
				"<input id='ally18' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally19' style='padding:2px 4px;'>"+
				"<input id='ally19' type='text' style='width:52px' />"+
			"</td>"+
			"<td id='fld_ally20' style='padding:2px 4px;'>"+
				"<input id='ally20' type='text' style='width:52px' />"+
			"</td>"+
			"<td style='background-color:black; padding:0px 4px; text-align:center;'>"+
				"<input id='graphtoolClear' type='button' value='消去' />"+
			"</td>"+
		"</tr>"+
		"</table>";
	
	//バージョン
	document.getElementById("version").innerHTML = "Ver." + VERSION;
	
	//着色
	for (var i = 0; i < ALLY_COLORS.length; i++) {
		document.getElementById("fld_ally" + (i+1)).style.backgroundColor = ALLY_COLORS[i];
	}
	
	//同盟を表示
	for (var i = 0; i < ALLYS.length; i++) {
		document.getElementById("ally" + (i+1)).value = ALLYS[i];
	}
	
	//イベントリスナー登録（保存ボタン）
	document.getElementById('graphtoolSave').addEventListener("click",
		function() {
			
			//入力同盟名をGreasemonkey領域に保存
			for (var i = 0; i < ALLY_COLORS.length; i++) {
				ALLYS[i] = trim(document.getElementById("ally" + (i+1)).value);
			}
			GM_setValue(location.hostname + "_allys", genDelimitString(ALLYS, DELIMIT));
			
			//グラフ再描画
			var toolElem = document.getElementById("graphtool");
			toolElem.removeChild(document.getElementById("graphMain"));
			addGraphHtml(toolElem);
		},
		true);
	
	//イベントリスナー登録（消去ボタン）
	document.getElementById('graphtoolClear').addEventListener("click",
		function() {clearAllys();}, true);
	
	//イベントリスナー登録（閉じるリンク）
	document.getElementById('graphtoolClose').addEventListener("click",
		function() {closeTool();}, true);
}

//説明ポップアップ初期化
function initPopup(parentElem) {

	//CSS
	addGlobalStyle(
		".popup{"+
			"position:absolute; left:0px; top:0px; visibility:hidden; "+
			"font-size:9pt; color:#0099FF; "+
			"background-color:#FFFFFF; layer-background-color:#FFFFFF; "+
			"border:1px solid #0099FF; padding:5; z-index:255;"+
		"}"
	);
	
	//HTMLタグ追加
	var popupElem = document.createElement('span');
	popupElem.id = "popup";
	popupElem.className =  "popup";
	parentElem.appendChild(popupElem);
	
	//イベントリスナー登録
	popupElem.addEventListener("mouseover",
		function() { this.style.visibility = "hidden" }, true);
}

//ポップアップOn関数作成
function createOnPopup(text) {
	return function(e) {
		onPopup(text, e.pageX, e.pageY);
	}
}

//ポップアップOn/Off
function onPopup(text, nX, nY) {
	var sX = -10, sY = 24;
	var msgElem = document.getElementById("popup");
	msgElem.innerHTML = text;
	msgElem.style.visibility = "visible";
	msgElem.style.left = (nX + sX) + "px";
	msgElem.style.top = (nY + sY) + "px";
}
function offPopup() {
	document.getElementById("popup").style.visibility = "hidden";
}

//同盟入力消去
function clearAllys() {
	for (var i = 0; i < ALLY_COLORS.length; i++) {
		document.getElementById("ally" + (i+1)).value = "";
	}
}

//ツールを閉じる
function closeTool() {
	document.getElementById("grayWrapper").style.display = "block";
	document.getElementById("graphtool").style.display = "none";
}

//同盟データ保存
function saveAllyData(name, data) {
	var saveData = new Array();
	for (var i = 0; i < data.length; i++) {
		saveData[i] = genDelimitString(data[i], DELIMIT2);
	}
	
	GM_setValue(generateAllyKey(name), genDelimitString(saveData, DELIMIT));
//console.log(generateAllyKey(name) +":"+ genDelimitString(saveData, DELIMIT));
}

//同盟データ読み込み
function loadAllyData(ally) {
	var ret = new Array();
	var src = GM_getValue(generateAllyKey(ally), "");
	
	var array1 = src.split(DELIMIT);
	for (var i = 0; i < array1.length; i++) {
		if (array1[i] != "") {
			ret[i] = array1[i].split(DELIMIT2);
		}
	}
	
	return ret;
}

//グラフ表示対象同盟を読み込み
function loadTargetAllys() {
	ALLYS = GM_getValue(location.hostname + "_allys", "").split(DELIMIT);
	
	//指定同盟なしなら現ランキング表示の同盟をデフォルト設定
	for (var i = 0; i < ALLYS.length; i++) {
		if (ALLYS[i] != "") return;
	}
	for (var i = 0; i < CURRENT_ALLYS.length; i++) {
		ALLYS[i] = CURRENT_ALLYS[i];
	}
}

//CSV出力
function outputCsv() {
	document.getElementById("grayWrapper").style.display = "none";
	
	var frameElem = document.createElement("iframe");
	frameElem.id = "toolCsvFrame";
	frameElem.style.width = "100%";
	frameElem.style.height = "540px";
	
	var container = document.getElementById("whiteWrapper");
	container.appendChild(frameElem);
	
	//時間がかかるので別スレッド化（一旦描画して砂時計を表示させる）
	setWaitCursor();
	window.setTimeout(function() {
		var frameDoc = document.getElementById("toolCsvFrame").contentDocument;
		var addElem = frameDoc.createElement("pre");
		addElem.id = "toolCsv";
		addElem.style.fontSize = "12px";
		frameDoc.body.appendChild(addElem);
		
		//タイトル行
		var csvText = "";
		csvText += "ALLIANCER,DATETIME,RANK,POINT,MEMBER\n";
		
		//データ行
		for (var i = 0; i < ALLYS_INDEX.length; i++) {
			
			//保存データ取得
			var srcData = loadAllyData(ALLYS_INDEX[i]);
			if (srcData.length == 0) continue;
			
			for (var j = 0; j < srcData.length; j++) {
				csvText += convCsvString(ALLYS_INDEX[i]);
				csvText += ",";
				csvText += srcData[j][IDX_DATETIME];
				csvText += ",";
				csvText += srcData[j][IDX_RANK];
				csvText += ",";
				csvText += srcData[j][IDX_POINT];
				csvText += ",";
				csvText += srcData[j][IDX_MEMBER];
				csvText += "\n";
			}
		}
		
		addElem.innerHTML = csvText;
		resetCursor();
	}, 0);
}

//同盟データキー生成
function generateAllyKey(allyName) {
	return location.hostname + "_ally_" + escape(allyName);
}

//検索用索引保存
function saveAllysIndex() {
	GM_setValue(location.hostname + "_allys_index", 
		genDelimitString(ALLYS_INDEX, DELIMIT));
}

//子Element取得
function getChildElement(parentNode, position) {
	var current = 0;
	for (var i = 0; i < parentNode.childNodes.length; i++){
		var childNode = parentNode.childNodes[i];
		if (childNode.nodeType == 1) {
			if (current == position) {
				return childNode;
			}
			current++;
		}
	}
	
	return undefined;
}

//カーソル変更
function setWaitCursor() {
	document.getElementsByTagName("body")[0].style.cursor = "wait";
}
function resetCursor() {
	document.getElementsByTagName("body")[0].style.cursor = "auto";
}

//CSS追加
function addGlobalStyle(css) {
	var head, style;
	head = document.getElementsByTagName("head")[0];
	if (!head) { return; } style = document.createElement("style");
	style.type = "text/css";
	style.innerHTML = css;
	head.appendChild(style);
}

//日時文字列編集（mm/dd hh:mm）
function generateDateString(date) {
	var res = "" + padZero(date.getMonth() + 1) + "/" + padZero(date.getDate()) + 
		" " + padZero(date.getHours()) + ":" + padZero(date.getMinutes());
	return res;
}

//先頭ゼロ付加
function padZero(num) {
	var result;
	if (num < 10) {
		result = "0" + num;
	} else {
		result = "" + num;
	}
	return result;
}

//空白除去
function trim(str) {
	return str.replace(/^[ 　\t\r\n]+|[ 　\t\r\n]+$/g, "");
}

//CSV用文字列変換
function convCsvString(str) {
	var result;
	
	//「"」を「""」に変換
	result = str.replace(/\"/g, "\"\"");
	
	//「,」を含む場合は全体を「"」で囲む
	if (result.indexOf(",") >= 0) {
		result = "\"" + result + "\""
	}
	
	return result;
}

//デリミタ区切り文字列生成
function genDelimitString(dataArray, delimiter) {
	var ret = "";
	for (var i=0; i < dataArray.length; i++) {
		if (dataArray[i] != undefined) ret += dataArray[i];
		if (i < dataArray.length-1) ret += delimiter;
	}
	return ret;
}

//配列検索
function searchArrayItem(array, key) {
	for (var i=0; i<array.length; i++) {
		if (array[i] == key) {
			return i;
		}
	}
	return -1;
}

//Google Chrome用GM_*系ラッパー関数
function initGMWrapper() {
	
	// @copyright      2009, James Campos
	// @license        cc-by-3.0; http://creativecommons.org/licenses/by/3.0/
	if ((typeof GM_getValue == 'undefined') || (GM_getValue('a', 'b') == undefined)) {
		GM_addStyle = function(css) {
			var style = document.createElement('style');
			style.textContent = css;
			document.getElementsByTagName('head')[0].appendChild(style);
		}

		GM_deleteValue = function(name) {
			localStorage.removeItem(LOCAL_STORAGE + "." + name);
		}

		GM_getValue = function(name, defaultValue) {
			var value = localStorage.getItem(LOCAL_STORAGE + "." + name);
			if (!value)
				return defaultValue;
			var type = value[0];
			value = value.substring(1);
			switch (type) {
				case 'b':
					return value == 'true';
				case 'n':
					return Number(value);
				default:
					return value;
			}
		}

		GM_log = function(message) {
			console.log(message);
		}

		 GM_registerMenuCommand = function(name, funk) {
		//todo
		}

		GM_setValue = function(name, value) {
			value = (typeof value)[0] + value;
			localStorage.setItem(LOCAL_STORAGE + "." + name, value);
		}
	}
}
