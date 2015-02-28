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
      c.consumables = [];
    if(c.consumables.indexOf(url) === -1) //if the url is not already saved
      c.consumables.push(url); //save it
    chrome.storage.local.set({'consumables': c.consumables});//update the storage
    if(cb)
      cb();
  });
}

//////////////////////////////// Consume Timer Script ///////////////////////////////////////////////

var tabTimes = {};
var prevTabUrl = '';

//creates the start time
function startTimer(tabUrl) {
  var d = new Date();
  if(!tabTimes[tabUrl])
    tabTimes[tabUrl] = {};
  tabTimes[tabUrl].startTime = d.getTime();
  //console.log(JSON.stringify(tabTimes));
}

//stops timer and deletes the startTime property
function stopTimer(tabUrl) {
  var d = new Date();
  if(!tabTimes[tabUrl].totalTime)
    tabTimes[tabUrl].totalTime = 0;
  tabTimes[tabUrl].totalTime += d.getTime() - tabTimes[tabUrl].startTime;
  delete tabTimes[tabUrl].startTime;
  console.log(JSON.stringify(tabTimes));
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
  //console.log('onActivated: ' + JSON.stringify(activeInfo));
  //if active tab is changed and timer is running
  if(tabTimes[prevTabUrl]) {
    if(tabTimes[prevTabUrl].startTime) {
      //stop it
      stopTimer(prevTabUrl);
    }
  }
  chrome.storage.local.get('consumables', function(c){
    if(c.consumables) {
      //may give an error when tabs are closed quickly
      //doesn't break anything though
      chrome.tabs.get(activeInfo.tabId, function(tab) {
        if(c.consumables.indexOf(stripFragment(tab.url)) !== -1) {
          startTimer(stripFragment(tab.url));
          prevTabUrl = stripFragment(tab.url);
        }
      });
    }
  });
});

//logic moved to onCommitted to support back button
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  //console.log('onUpdated: ' + JSON.stringify(changeInfo));
  //if going to a new page (in the current tab)
/*   if(changeInfo.url && tab.active) {
    if(stripFragment(changeInfo.url) !== prevTabUrl) {
      //stop the timer on the previous page
      if(tabTimes[prevTabUrl]) {
        if(tabTimes[prevTabUrl].startTime) {
          //stop it
          stopTimer(prevTabUrl);
        }
      }
      //start the timer for the new page (if saved)
      chrome.storage.local.get('consumables', function(c){
        if(c.consumables) {
          if(c.consumables.indexOf(stripFragment(changeInfo.url)) !== -1) {
            startTimer(stripFragment(changeInfo.url));
            prevTabUrl = stripFragment(changeInfo.url);
          }
        }
      });
    }
  } */
});

chrome.webNavigation.onCommitted.addListener(function(details) {
  //console.log(JSON.stringify(details));
  
  //if going to a new page (in the current tab)
  chrome.tabs.get(details.tabId, function(tab) {
    if(details.url && tab.active) {
      if(stripFragment(details.url) !== prevTabUrl) {
        
        //stop the timer on the previous page
        if(tabTimes[prevTabUrl]) {
          if(tabTimes[prevTabUrl].startTime) {
            //stop it
            stopTimer(prevTabUrl);
          }
        }
        
        //start the timer for the new page (if saved)
        chrome.storage.local.get('consumables', function(c){
          if(c.consumables) {
            if(c.consumables.indexOf(stripFragment(details.url)) !== -1) {
              startTimer(stripFragment(details.url));
            }
          }
        });
        
        prevTabUrl = stripFragment(details.url);
      }
    }
  });
});
