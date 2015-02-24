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

function saveLink(url) {
  //chrome.storage.local.clear();
  chrome.storage.local.get('consumables', function(c){
    if(!c.consumables)
      c.consumables = [];
    if(c.consumables.indexOf(url) === -1) //if the url is not already saved
      c.consumables.push(url); //save it
    chrome.storage.local.set({'consumables': c.consumables});//update the storage
    //chrome.storage.local.get('consumables', function(c){
      //console.log(JSON.stringify(c.consumables));
    //});
  });
}