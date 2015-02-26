//gets the url of the current tab and saves the link
function saveLinks(e) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      //console.log('Saved: ' + tabs[0].url);
      saveLink(tabs[0].url);
      //window.close();
  });
}

//creates a list of all saved links
//may need to add pages to support lots of links
function showLinks(e) {
  var viewDiv = document.getElementById('viewDiv');
  var linkList;
  chrome.storage.local.get('consumables', function(c){
    //console.log(JSON.stringify(c.consumables));
    linkList = '<ul>\n';
    linkList += '<li><div><span id="closeLink">Close</span></div></li>\n';
    for(link in c.consumables) {
      //console.log(c.consumables[link]);
      linkList += '<li><div><a href="'+c.consumables[link]+'">'+c.consumables[link]+'</a></div></li>\n';
    }
    linkList += '</ul>\n';
    //console.log(linkList);
    viewDiv.innerHTML = linkList;
    document.getElementById('closeLink').addEventListener('click', hideLinks);
  });
}

//close the list of links
function hideLinks(e) {
  var viewDiv = document.getElementById('viewDiv');
  viewDiv.innerHTML = '<span id="viewLink">View Consumables</span>';
  document.getElementById('viewLink').addEventListener('click', showLinks);
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

document.addEventListener('DOMContentLoaded', function () {
  var saveDiv = document.getElementById('saveLink');
  saveDiv.addEventListener('click', saveLinks);
  
  var viewLink = document.getElementById('viewLink');
  viewLink.addEventListener('click', showLinks);
});
