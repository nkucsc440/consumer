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

var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

function saveLink(url, cb) {
  url = stripFragment(url);
  url = url.replace(/.*?:\/\//g, "");
  
  chrome.storage.local.get('user', function(c) {
    if(!c.user) {
      cb();//no user, don't save
      return;
    }
    //console.log(restServer+'users/'+c.user.uid);
    $.ajax({
      method: 'get',
      url: restServer+'consumables/',
      success: function(data, textStatus, jqXHR) {
        if(!findUrl(url, data.consumables)) { //if url is not already in consumables
          $.ajax({
            url: restServer+'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            success: function(data2, textStatus, jqXHR) {
              addConsumable(c.user.uid, data2.consumable._id, cb);
            }
          });
        }
        else {
          var cid = data.consumables[findUrl(url, data.consumables)]._id;
          addConsumable(c.user.uid, cid, cb);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('error: '+errorThrown);
      },
      complete: function(jqXHR, textStatus) {
        console.log('complete: '+textStatus);
      }
    });
  });
}

function addConsumable(uid, cid, cb) {
  $.ajax({
    url: restServer+'consumptions/',
    method: 'post',
    dataType: 'json',
    data: {
      consumption: {
        _user: uid,
        _consumable: cid
      }
    },
    success: function(data, textStatus, jqXHR) {
      console.log(data);
      return;
      cb();
    }
  });
}

function findUrl(url, consumables) {
  for(var i in consumables) {
    if(consumables[i].url === url)
      return i;
  }
  return false;
}

function saveTime(url, time, cb) {
  chrome.storage.local.get('consumables', function(c){
    if(!c.consumables)
      c.consumables = {};
    if(c.consumables[url]){
      if(c.consumables[url].totalTime) {
        c.consumables[url].totalTime += time;
      }
      else {
        c.consumables[url].totalTime = time;
      }
    }
    else{
      c.consumables[url] = {};
      c.consumables[url].totalTime = time;
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

chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  if(msg.tab) {
    tab = msg.tab;
    watchedTabs.push(tab);
    tabIds.push(tab.id);
    startTimer(tab.url);
  }
  if(msg.getActive) {
    cb(watchedTabs);
  }
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
