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

//////////////////////////////// Consume Timer Script ///////////////////////////////////////////////

var tabTimes = {};
var tabIds = [];
var watchedTabs = [];
var prevTabId = -1;

//creates the start time
function startTimer(tabUrl) {
  tabUrl = tabUrl.replace(/.*?:\/\//g, "");
  var d = new Date();
  if(!tabTimes[tabUrl])
    tabTimes[tabUrl] = {};
  tabTimes[tabUrl].startTime = d.getTime();
}

//stops timer and deletes the startTime property
function stopTimer(tabUrl) {
  tabUrl = tabUrl.replace(/.*?:\/\//g, "");
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

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(tabIds.indexOf(tabId) !== -1) {
    //console.log(tab);
  }
});

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
    if(cb) cb();
  });
}

///////////////////////////// Session Info //////////////////////////////
var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

function initTimer(tab){
  watchedTabs.push(tab);
  tabIds.push(tab.id);
  startTimer(tab.url);
}

chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  //Request to start a timer for a tab
  if(msg.tab) {
    initTimer(msg.tab);
  }
  //Request for all active tabs (timers)
  if(msg.getActive) {
    cb(watchedTabs);
  }
  //Request for the total time spent on a certain tab
  if(msg.getTime) {
    msg.getTime = msg.getTime.replace(/.*?:\/\//g, "");
    if(tabTimes[msg.getTime].startTime) {
      stopTimer(msg.getTime);
    }
    cb(tabTimes[msg.getTime].totalTime);
  }
  //Request to close the session
  if(msg.logout) {
    logout();
    cb();
  }
  //Request to start a session
  //Includes callbacks for success/error
  if(msg.login) {
    login(msg.user, msg.pass);
  }
  //Request to save a link
  if(msg.link) {
    saveLink(msg.link);
  }
  //Request to consume a link
  if(msg.consume) {
    consumeLink(msg.time, msg.cid);
  }
});

function saveLink(url){
  url = stripFragment(url);
  url = url.replace(/.*?:\/\//g, "");
  
  chrome.storage.local.get('user', function(c) {
    if (!c.user) {
      return;//nobody is logged in
    }
    //console.log(restServer+'users/'+c.user.uid);
    $.ajax({
      method: 'get',
      url: restServer + 'consumables',
      success: function(data, textStatus, jqXHR) {
        if (!findUrl(url, data.consumables)) { //if url is not already in consumables add it
          $.ajax({
            url: restServer + 'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            success: function(data2, textStatus, jqXHR) {
              addConsumable(data2.consumable._id);
            }
          });
        } else {
          var cid = data.consumables[findUrl(url, data.consumables)]._id;
          addConsumable(cid);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('error: ' + errorThrown);
      },
      complete: function(jqXHR, textStatus) {
        console.log('complete: ' + textStatus);
      }
    });
  });
}

function addConsumable(cid) {
  chrome.storage.local.get('user', function(c) {
    console.log(c.user);
    var user = c.user;
    $.ajax({
      url: restServer + 'consumptions/',
      method: 'post',
      dataType: 'json',
      data: {
        consumption: {
          "_user": user._id,
          "_consumable": cid
        }
      },
      success: function(data, textStatus, jqXHR) {
        console.log('Added: ');
        console.log(data);
        startSession();
      }
    });
  });
}

function consumeLink(time, cid){
  $.ajax({
    method: 'put',
    url: restServer + 'consumptions/' + cid,
    contentType: "application/json",
    data: JSON.stringify({
      "consumption": {
        "consumeTime": time,
        "consumed": true
      }
    }),
    error: function(jqXHR, textStatus, errorThrown) {
      console.log('error: ' + errorThrown);
    },
    complete: function(jqXHR, textStatus) {
      console.log('complete: ' + textStatus);
      chrome.storage.local.remove('currentConsumption');
      startSession();
      chrome.runtime.sendMessage({close: true});
    }
  });
}

function findUrl(url, consumables) {
  url = url.replace(/.*?:\/\//g, "");
  for (var i in consumables) {
    if (consumables[i].url === url)
      return i;
  }
  return false;
}

function logout(){
  $.ajaxSetup({
    headers: {}
  });
  chrome.storage.local.remove('user');
}

function login(user, pass){
    console.log('beginning login');
    $.ajaxSetup({
      headers: {
        'Authorization': 'Basic ' + btoa(user + ':' + pass)
      }
    });
    startSession();
}

function startSession(){
  console.log('starting session');
  $.ajax({
    method: 'get',
    url: restServer + 'me',
    success: function(responseData, textStatus, jqXHR) {
      console.log('login success');

      chrome.storage.local.get('user', function(c) {
        if (!c) {
          c = {};
        }
        c.user = responseData.user;
        chrome.storage.local.set(c); //update the storage
        chrome.runtime.sendMessage({update: true}); //send msg to update popup
      });
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown);
      chrome.runtime.sendMessage({logout: true}); //send msg to update popup
    }
  });
}

function stripFragment(url) {
  return url.split('#')[0];
}

function clearConsumables() {
  chrome.storage.local.clear();
}

//////////////////////////Refactor//////////////////////////////////////

var restServer = 'https://consumit-rest-nodejs.herokuapp.com/api/';

var Util = {
  clearConsumables: function(){
    chrome.storage.local.clear();
  },
  normalize: function(url){ //Strip the fragment from a url (so a single page doesn't appear as a different page)
    url = url.split('#')[0];
    url = url.replace(/.*?:\/\//g, "");
    return url;
  },
  findUrl: function(url, consumables){
    url = url.replace(/.*?:\/\//g, "");
    for (var i in consumables) {
      if (consumables[i].url === url)
        return i;
    }
    return false;
  }
}

//Manages all information about the current user and the connection to the rest server
var DatabaseAdaptor = {
  user: 0, //The current user id
  setHeader: function(user, pass){ //Equal to login
    console.log('Setting user info header');
    $.ajaxSetup({
      headers: {
        'Authorization': 'Basic ' + btoa(user + ':' + pass)
      }
    });
  },
  initSession: function(){ //Initialize the session (and get user id)
    console.log('Starting new session');
    $.ajax({
      method: 'get',
      url: restServer + 'me',
      success: function(response, textStatus, jqXHR) {
        console.log('Logged in ' + response.user._id);
        DatabaseAdaptor.user = response.user._id;//can't use this because cb is called outside of object
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log(errorThrown);
      }
    });
  },
  clearHeader: function(){ //Equal to logout
    $.ajaxSetup({
      headers: {}
    });
    this.user = 0;
    console.log(DatabaseAdaptor);
  },
  completeConsumption: function(cid, time){ //Completes a consumption (sets consume time)
    //no need to check for user since user is linked to consumption id
    $.ajax({
      method: 'put',
      url: restServer + 'consumptions/' + cid,
      contentType: "application/json",
      data: JSON.stringify({
        "consumption": {
          "consumeTime": time,
          "consumed": true
        }
      }),
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error completing consumption: ' + errorThrown);
      },
      success: function(data, textStatus, jqXHR) {
        console.log('Completed consumption: ');
        console.log(data);
        chrome.storage.local.remove('currentConsumption');//TODO: figure this out
      }
    });
  },
  addConsumption: function(cid){ //Creates a new consumption (saves link for current user)
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      url: restServer + 'consumptions/',
      method: 'post',
      dataType: 'json',
      data: {
        consumption: {
          "_user": this.user,
          "_consumable": cid
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error adding consumption: ' + errorThrown);
      },
      success: function(data, textStatus, jqXHR) {
        console.log('Added consumption: ');
        console.log(data);
      }
    });
  },
  addConsumable: function(url){ //Creates a consumable (check for new link and add if necessary) and then adds to user
    url = Util.normalize(url);
    if(!this.user){
      console.log('No user logged in');
      return;
    }
    $.ajax({
      method: 'get',
      url: restServer + 'consumables',
      success: function(data, textStatus, jqXHR) {
        if (!Util.findUrl(url, data.consumables)) { //if url is not already in consumables add it
          $.ajax({
            url: restServer + 'consumables/',
            method: 'post',
            dataType: 'json',
            data: {
              consumable: {
                url: url
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.log('Error adding consumable: ' + errorThrown);
            },
            success: function(data2, textStatus, jqXHR) {
              //and then add the consumption
              DatabaseAdaptor.addConsumption(data2.consumable._id);
            }
          });
        }
        else {
          //else just add the consumption
          var cid = data.consumables[Util.findUrl(url, data.consumables)]._id;
          DatabaseAdaptor.addConsumption(cid);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log('Error getting consumables: ' + errorThrown);
      }
    });
  }
}