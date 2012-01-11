// ==UserScript==
// @name           bro3_growth_checker
// @version        1.07
// @namespace      http://blog.livedoor.jp/froo/
// @include        http://*.3gokushi.jp/user/*
// @include        http://*.1kibaku.jp/user/*
// @description    ブラウザ三国志 発展チェッカー by 浮浪プログラマ
// ==/UserScript==

// 公開ページ: http://blog.livedoor.jp/froo/archives/51383261.html
// 使い方: 君主プロフィールページを表示

var VERSION = "1.07";
var LOCAL_STORAGE = "bro3_growth_checker";

var DELIMIT = "#$%";

//main
(function(){
	
	//mixi鯖障害回避用: 広告iframe内で呼び出されたら無視
	var container = document.evaluate('//*[@id="container"]',
		document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	if (container.snapshotLength == 0) return;
	
	//プロフィールページ以外なら処理しない
	if (location.pathname != "/user/" && location.pathname != "/user/index.php") {
		return;
	}
	
	initGMWrapper();
	
	//「君主」欄取得
	var user = "";
	var userElem = document.evaluate(
		'//*[@id="gray02Wrapper"]//table/tbody/tr[2]/td[2]',
		document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	user = userElem.snapshotItem(0).innerHTML;
	
	//前回値取得
	var data = new Array();
	var dataStr = GM_getValue(generateUserKey(user));
	if (dataStr != undefined) {
		data = dataStr.split(DELIMIT);
	}
	
	//各値欄取得
	var fieldPaths = new Array(
		'//*[@id="gray02Wrapper"]//table/tbody/tr[4]/td[3]', //ランク
		'//*[@id="gray02Wrapper"]//table/tbody/tr[5]/td[2]', //総合
		'//*[@id="gray02Wrapper"]//table/tbody/tr[6]/td[2]', //総人口
		'//*[@id="gray02Wrapper"]//table/tbody/tr[6]/td[4]', //拠点
		'//*[@id="gray02Wrapper"]//table/tbody/tr[7]/td[2]', //攻撃
		'//*[@id="gray02Wrapper"]//table/tbody/tr[7]/td[4]', //防御
		'//*[@id="gray02Wrapper"]//table/tbody/tr[8]/td[2]', //撃破スコア
		'//*[@id="gray02Wrapper"]//table/tbody/tr[8]/td[4]', //防衛スコア
		'//*[@id="gray02Wrapper"]//table/tbody/tr[4]/td[5]', //同盟
		'//*[@id="gray02Wrapper"]//table/tbody/tr[5]/td[4]'  //役職
	);
	for (var i=0; i<fieldPaths.length; i++) {
		var targetElem = document.evaluate(fieldPaths[i],
			document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
		var value = targetElem.snapshotItem(0).innerHTML;
		
		var dataItem = new Array();
		if (data[i] != undefined) {
			dataItem = data[i].split(",");
		}
		
		//値変化を表示
		var lastUpdate = getCurrentTime();
		
		//日時表示編集
		var dateText = dataItem[1];
		if (dateText == undefined) dateText = lastUpdate;
		dateText = dateText.replace(/^[0-9]{4}-/, "");
//		dateText = dateText.replace(/-/, "/");
//		dateText = dateText.replace(/^0([0-9])/, "$1");
//		dateText = dateText.replace(/\/0([0-9])/, "/$1");
		dateText = dateText.replace(/:[0-9]{2}$/, "");
		if (dataItem[0] != undefined && value != dataItem[0]) {
			targetElem.snapshotItem(0).style.color = "red";
			targetElem.snapshotItem(0).innerHTML = 
				value + " ← " + dataItem[0] + 
				" (" + dateText + " ～)";
		} else {
			targetElem.snapshotItem(0).innerHTML = 
				value + " (" + dateText + " ～)";
		}
		
		//値に変更があったら更新
		if (value != dataItem[0]) {
			dataItem[0] = value;
			dataItem[1] = lastUpdate;
			data[i] = dataItem;
		}
	}
	
	//値を保存
	GM_setValue(generateUserKey(user), genDelimitString(data, DELIMIT));
//console.log(generateUserKey(user) + ": " + genDelimitString(data, DELIMIT));
})();

//君主データキー生成
function generateUserKey(userName) {
	return location.hostname + "_user_" + escape(userName);
}

//現在時刻取得（yyyy-mm-dd hh:mm:ss）
function getCurrentTime() {
	var date = new Date();
	var res = "" + date.getFullYear() + "-" + padZero(date.getMonth() + 1) + 
		"-" + padZero(date.getDate()) + " " + padZero(date.getHours()) + ":" + 
		padZero(date.getMinutes()) + ":" + padZero(date.getSeconds());
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

//デリミタ区切り文字列生成
function genDelimitString(dataArray, delimiter) {
	var ret = "";
	for (var i=0; i < dataArray.length; i++) {
		if (dataArray[i] != undefined) ret += dataArray[i];
		if (i < dataArray.length-1) ret += delimiter;
	}
	return ret;
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
