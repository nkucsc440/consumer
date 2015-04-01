///////////////////////////////// Right click menu ///////////////////////////////////////
var title = "Consume later";
//Button only appears when right clicking a link
var id = chrome.contextMenus.create({
  "title": title,
  "contexts":['link'],
  "onclick": handleLink
});
//console.log("Link item:" + id);

function handleLink(info, tab) {
  //console.log(info.linkUrl);
  saveLink(info.linkUrl);
}

function stripFragment(url) {
  return url.split('#')[0];
}

function saveLink(url, cb) {
  url = stripFragment(url);
  chrome.storage.local.get('consumables', function(c){
    if(!c.consumables)
      c.consumables = {};
    if(!c.consumables[url]) //if the url is not already saved
      c.consumables[url] = {}; //save it
    chrome.storage.local.set({'consumables': c.consumables});//update the storage
    if(cb)
      cb();
  });
}

function saveTime(url, time, cb) {
  chrome.storage.local.get('consumables', function(c){
    if(c.consumables[url] !== -1){
      if(c.consumables[url].totalTime) {
        c.consumables[url].totalTime += time;
      }
      else {
        c.consumables[url].totalTime = time;
      }
    }
    chrome.storage.local.set({'consumables': c.consumables});//update the storage
    if(cb)
      cb();
  });
}

//////////////////////////////// Consume Timer Script ///////////////////////////////////////////////

var tabTimes = {};
var tabIds = [];
var watchedTabs = [];
var prevTabId = -1;

//creates the start time
function startTimer(tabUrl) {
  var d = new Date();
  if(!tabTimes[tabUrl])
    tabTimes[tabUrl] = {};
  tabTimes[tabUrl].startTime = d.getTime();
  //console.log(tabTimes);
}

//stops timer and deletes the startTime property
function stopTimer(tabUrl) {
  var d = new Date();
  if(!tabTimes[tabUrl].totalTime)
    tabTimes[tabUrl].totalTime = 0;
  tabTimes[tabUrl].totalTime += d.getTime() - tabTimes[tabUrl].startTime;
  var time = d.getTime() - tabTimes[tabUrl].startTime;
  saveTime(tabUrl, time, function(){
    chrome.storage.local.get('consumables', function(c){
      console.log(c);
    });
  });
  delete tabTimes[tabUrl].startTime;
}

chrome.runtime.onMessage.addListener(function(tab, sender) {
  watchedTabs.push(tab);
  tabIds.push(tab.id);
  startTimer(tab.url);
  sendRequest();
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(tabIds.indexOf(tabId) !== -1) {
    //console.log(tab);
  }
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
  if(tabIds.indexOf(prevTabId) !== -1) {
    stopTimer(watchedTabs[tabIds.indexOf(prevTabId)].url);
  }
  prevTabId = activeInfo.tabId;
  if(tabIds.indexOf(activeInfo.tabId) !== -1) {
    startTimer(watchedTabs[tabIds.indexOf(activeInfo.tabId)].url);
  }
}); 
/////////////////////////////////////Ajax stuff//////////////////////////////////////////
function sendRequest() {
  return;
  var server = 'https://consumit-rest-nodejs.herokuapp.com/api/';

  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange=function() {
    if (xmlhttp.readyState==4 && xmlhttp.status==200) {
      var response = JSON.parse(xmlhttp.response);
      //console.log(response);
    }
  }
  xmlhttp.open("GET", server+'users', true);
  xmlhttp.send();
  
  var xmlhttppost = new XMLHttpRequest();
  xmlhttppost.open("POST", server+'users', true);
  xmlhttppost.onreadystatechange=function() {
    if (xmlhttppost.readyState==4 && xmlhttppost.status==200) {
      var response = JSON.parse(xmlhttppost.response);
      console.log(response);
    }
  }
  var data = {
    user: {
      email: "shutupandjam@gmail.com",
      firstName: "Chaos",
      lastName: "Dunk"
    }
  }
  xmlhttppost.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  xmlhttppost.send(JSON.stringify(data));
}