import { PopupUtils } from "../../../utils/PopupUtils";
import { NetworkPojo } from "./../../../modals/frontend/network/NetworkPojo.js";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";
import "./chat.html";
import {
  AllChatroomData,
  UnreadMessages,
} from "./../../../collections/chat_collection.js";
import { CurrentChatroomData } from "./../../../collections/chat_collection.js";
import { LocalMessages } from "./../../../collections/chat_collection.js";
import { MuteChatrooms } from "./../../../collections/chat_collection.js";
import { OnlineUsers } from "./../../../collections/chat_collection.js";

import { Utils } from "./../../../utils/utils.js";
import { ErrorMessages } from "./../../../utils/ErrorMessages";
import { ChatroomPojo } from "./../../../modals/frontend/messaging/ChatroomPojo.js";

import { ChatNetwork } from "../../../network/itg/chat-network/chat-network.js";
import { SES } from "aws-sdk";

const htmlToText = require("html-to-text");
const axios = require("axios").default;

var userOnlineTracker;
var socketObj = null;
var socketGlobal = null;
function getSocketObj() {
  var io = require("socket.io-client");
  return  io.connect(Meteor.absoluteUrl() + "mobile-chat");;
}
function playNotificationSound() {
  Meteor.call(
    "fetch_all_unread_messages_and_notifications_count",
    Session.get("user_id"),
    function (error, result) {
      if (error) {
        // console.log("Error");
      } else {
        if (result.chat_message) {
          playSound();
        }
      }
    }
  );
}

function playSound() {
  if (Session.get("notificationPlaying") == false) {
    Session.set("notificationPlaying", true);

    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf("safari") != -1) {
      if (ua.indexOf("chrome") > -1) {
        var notification = new Audio("/uploads/ting.ogg");
        notification.play(); // Chrome
      } else {
        var urlSound = Meteor.absoluteUrl() + "uploads/ting.ogg";
        $.getScript(
          "https://cdnjs.cloudflare.com/ajax/libs/howler/2.1.3/howler.min.js",
          function () {
            var sound = new Howl({
              src: [urlSound],
              format: "ogg",
              buffer: true,
              autoplay: true,
              stereo: -1,
              onloaderror: function () {
                console.log("Load error!");
              },
              onend: function () {
                console.log("Finished!");
              },
            });

            sound.on("load", function () {
              console.log("loaded");
              sound.play("blast");
            });
          }
        );
      }
    } else {
      var notification = new Audio("/uploads/ting.ogg");
      notification.play();
    }
    setTimeout(function () {
      Session.set("notificationPlaying", false);
    }, 1000);
  }
}

function configureSockets() {
  socketObj = getSocketObj();
  if (Meteor.isClient && socketObj != null) {
   
    socketObj.on('message_updated',function(obj){
      if(obj.length!=0){
        if(obj.chatroom_id == Session.get("active_chatroom_id") && Utils.getLoggedInUserId() != obj.user_id){
            LocalMessages._collection.update({message_id: obj.message_id},{$set:{
                                                                                is_edited: true,
                                                                                 message: obj.message,
                                                                                  attachment_url: obj.messageAttachment}});
      
        
            var checkLastMessage = AllChatroomData.find({'last_message_details.message_id': obj.message_id}).fetch();                                                                        
              if(checkLastMessage.length!=0){
                console.log("Last message updated");
                var last_message_details = checkLastMessage[0].last_message_details;
                var last_message ="";
                if(obj.messageAttachment==undefined || obj.messageAttachment==""){
                  last_message_details[0].message = obj.message;
                  last_message = obj.message;
                }else{
                  last_message_details[0].message = "<i class='fa fa-paperclip'></i> Media";
                  last_message = "<i class='fa fa-paperclip'></i> Media";
                }
                console.log(last_message_details);
                AllChatroomData._collection.update({_id: checkLastMessage[0]._id},{$set:{last_message_details:last_message_details,last_message:last_message}});
              }
          }
      }
    })
    socketObj.on('emit_typing_event_server',function(obj){
      if(obj.length!=0){
        if(obj[0].chatroom_id == Session.get("active_chatroom_id") && Utils.getLoggedInUserId() != obj[0].user_id){
            CurrentChatroomData._collection.update({chatroom_id: obj[0].chatroom_id},{$set:{is_typing: obj[0].is_typing}});
        }
      }
    })
    socketObj.on('user_online_event',function(obj){
      if(obj.length!=0){
        
        if(obj[0].user_id != Utils.getLoggedInUserId()){
          var fetchAllUsersReceivedOnlineStatus = AllChatroomData.find({"user_details.user_id": obj[0].user_id}).fetch();    
          if(fetchAllUsersReceivedOnlineStatus.length!=0){
            AllChatroomData._collection.update({"user_details.user_id": obj[0].user_id},{$set:{online_status: obj[0].is_online}});
            CurrentChatroomData._collection.update({"user_details.user_id": obj[0].user_id},{$set:{online_status: obj[0].is_online}});
          }    
        }
      }
    })
    socketObj.on("message_delivered",function(message_id){
      var localMessagesCount =   LocalMessages._collection.find({message_id:message_id}).count();
      if(localMessagesCount==1){
        LocalMessages._collection.update({message_id:message_id},{$set:{delivery_status:1}});
      }
    });
    socketObj.on("delete_message",function(message_id){
      var localMessagesCount =   LocalMessages._collection.find({message_id:message_id}).count();
      if(localMessagesCount==1){
        LocalMessages._collection.update({message_id:message_id},{$set:{is_deleted:true}});
        var checkIfLast = LocalMessages.find({},{sort:{created_at:-1}, limit:1}).fetch();
        if(checkIfLast.length!=0){
          AllChatroomData._collection.update({chatroom_id:checkIfLast[0].chatroom_id},{$set:{last_message: "Message deleted"}});
        }
      }
    });
    socketObj.on("user_blocked",function(obj){
      if(obj.user_id != Utils.getLoggedInUserId()){
        AllChatroomData._collection.update({chatroom_id:obj.chatroom_id},{$set:{user_blocked_by_other_user:true}});
        CurrentChatroomData._collection.update({chatroom_id:obj.chatroom_id},{$set:{user_blocked_by_other_user:true}});
      }
      
    });
    socketObj.on("user_unblocked",function(obj){
      if(obj.user_id!=Utils.getLoggedInUserId()){
        CurrentChatroomData._collection.update({chatroom_id:obj.chatroom_id},{$set:{user_blocked_by_other_user:false}});
        AllChatroomData._collection.update({chatroom_id:obj.chatroom_id},{$set:{user_blocked_by_other_user:false}});
       
      }
    });
    
    socketObj.on(
      "new_message_to_user",
      function (
       obj
      ) {
        var senderUserId = obj.user_id;
        var message = obj.message;
        var chatroomId = obj.chatroomId;
        var messageType = obj.messageType;
        var messageId = obj.message_id;
        var attachment = obj.messageAttachment;
        var isMute = obj.chatroom_muted;
        var metadata_details = obj.metadata_details;
        var is_gif = obj.is_gif;
        var repliedMessage = undefined;
        var checkIfChatroomExists = AllChatroomData._collection
          .find({ chatroom_id: chatroomId })
          .fetch();

        if (checkIfChatroomExists.length == 0) {
          // console.log("Refreshing Current Subscription");
          fetchAllUserChatrooms(10,0);
        } else {
          // Check IF current route contains the chatroom Id or not
          if (
            FlowRouter.current().params.chatroomId != undefined &&
            FlowRouter.current().params.chatroomId != "" &&
            FlowRouter.current().params.chatroomId != null && 
            FlowRouter.current().queryParams.query == undefined
          ) {
            //Current User is in the Messaging Panel
            if (
              Utils.decodedEncodedString(FlowRouter.current().params.chatroomId) == chatroomId &&
              senderUserId != Utils.getLoggedInUserId()
            ) {
              var data = {};
              data.message_id = messageId;
              data.chatroom_id = chatroomId;
              data.created_by = senderUserId;
              data.message_type = messageType;
              data.message = message;
              if (data.message_type != "TEXT") {
                data.attachment_url = attachment;
              }
              data.metadata_details = metadata_details;
              data.is_gif = is_gif;
              data.delivery_status = 1; //Delivery Status 0 = Delivered, 1 = Read
              data.created_at = Date.now();
              if (repliedMessage!=undefined)
                if( repliedMessage.length != 0) {
                  data.is_replied = true;
                  data.replied_message_data = repliedMessage;
                }
              // console.log("Adding Message in Collection");
              LocalMessages._collection.insert(data);
              if (!isMute) {
                playSound();
              }

              socketObj.emit('update_message_delivery_status',data.message_id )
              setTimeout(function () {
                $("body").has("#all_messages_div");
                $("#all_messages_div").animate(
                  { scrollTop: $("#all_messages_div").prop("scrollHeight") },
                  1
                );
              }, 10);
              // Update Regarding Message Delivery Status
              if (messageType == "TEXT") {
                AllChatroomData._collection.update(
                  { chatroom_id: chatroomId },
                  {
                    $set: {
                      last_message: message,
                      last_message_time: Date.now(),
                    },
                  }
                );
              } else {
                AllChatroomData._collection.update(
                  { chatroom_id: chatroomId },
                  {
                    $set: {
                      last_message: "New Message",
                      last_message_time: Date.now(),
                    },
                  }
                );
              }
            } else {
              var increaseUnreadCount = AllChatroomData._collection
                .find({ chatroom_id: chatroomId })
                .fetch();
              var unread_messages = increaseUnreadCount[0].unread_messages;
              var last_message = "";

              if (messageType == "TEXT") {
                last_message = message;
              } else {
                last_message = "New Message";
              }

              if (senderUserId != Utils.getLoggedInUserId() && increaseUnreadCount.length!=0) {
                if (!isMute) {
                  playSound();
                }
                UnreadMessages._collection.insert({
                  message_id: messageId,
                  chatroom_id: chatroomId,
                });
                // console.log({message_id: messageId, chatroom_id: chatroomId});
                // console.log("All Unread messages");
                var allUnreadMessages = UnreadMessages.find({
                  chatroom_id: chatroomId,
                }).fetch();
                var unique = [
                  ...new Set(allUnreadMessages.map((item) => item.message_id)),
                ];
              
                unique = allUnreadMessages.length;
                AllChatroomData._collection.update(
                  { chatroom_id: chatroomId },
                  {
                    $set: {
                      last_message: last_message,
                      unread_messages: allUnreadMessages.length + unread_messages,
                      last_message_time: Date.now(),
                    },
                  }
                );
                console.log(
                  "updating the left Panel for the new message 1:" +
                    allUnreadMessages.length
                );

              }
            }
          }
        }

        if (
          FlowRouter.current().path == "/chat"
        ) {
          var increaseUnreadCount = AllChatroomData._collection
            .find({ chatroom_id: chatroomId })
            .fetch();
          var unread_messages = increaseUnreadCount[0].unread_messages;
          var last_message = "";

          if (messageType == "TEXT") {
            last_message = message;
          } else {
            last_message = "New Message";
          }
          if (senderUserId != Utils.getLoggedInUserId()) {
            if (!isMute) {
              playSound();
            }
          }
          UnreadMessages._collection.insert({
            message_id: messageId,
            chatroom_id: chatroomId,
          });
          var allUnreadMessages = UnreadMessages.find({
            chatroom_id: chatroomId,
          }).fetch();
          allUnreadMessages = Utils.findUnique(
            allUnreadMessages,
            (d) => d.message_id
          );

          AllChatroomData._collection.update(
            { chatroom_id: chatroomId },
            {
              $set: {
                last_message: last_message,
                unread_messages: allUnreadMessages.length + unread_messages,
                last_message_time: Date.now(),
              },
            }
          );
          console.log(
            "updating the left Panel for the new message:" +
              (unread_messages + 1)
          );         
        }
      }
    );

    // 
   

   
  }
}

Template.chat.helpers({
  check_if_equals_to_current_chatroom_id: function (chatroom_id) {
    if (Session.get("active_chatroom_id")) {
      return chatroom_id == Session.get("active_chatroom_id");
    }
  },
  chatroomLoaded: function () {
    return Session.get("chatroomLoaded");
  },
  check_if_mobile: function () {
    return Meteor.Device.isPhone() || Meteor.Device.isTablet();
  },
  searchActive: function () {
    return Session.get("searchActive");
  },
  calculate_time_difference: function (a) {
    var dt = new Date(a);
    var millis = new Date().getTime() - dt.getTime();
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);

    var hours = (millis / (1000 * 60 * 60)).toFixed(1);

    var days = (millis / (1000 * 60 * 60 * 24)).toFixed(1);
    if (minutes < 1 && seconds < 10) {
      return "now";
    } else if (minutes < 1 && seconds < 59) {
      return seconds + "s";
    } else if (minutes >= 1 && minutes <= 59) {
      return minutes + "m";
    } else if (minutes >= 60 && hours < 24) {
      if (Math.floor(hours) == 1 || minutes == 60) {
        return Math.floor(hours) + "h";
      } else {
        return Math.floor(hours) + "h";
      }
    } else if (hours > 24) {
      if (Math.floor(days) == 1) {
        return Math.floor(days) + "d";
      } else {
        if (days >= 30) {
          if (days > 365) {
            var years = days / 365;
            return Math.floor(years) + "Y";
          } else if (days < 365) {
            var months = days / 30;
            return Math.floor(months) + "M";
          }
        }
        if (days >= 7) {
          var weeks = days / 7;
          return Math.floor(weeks) + "W";
        } else {
          return Math.floor(days) + "d";
        }
      }
    } else {
      return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }
  },
  fetch_all_user_chatrooms: function () {
    var query = Session.get("search_query");
    query = new RegExp(query, "i");
    var allChatrooms = AllChatroomData.find(
      {'user_details.name': query},
      { sort: { last_message_time: -1 } }
    ).fetch();
    allChatrooms = Utils.findUnique(allChatrooms, (d) => d.chatroom_id);

    for (var i = 0; i < allChatrooms.length; i++) {
      if (allChatrooms[i].is_creator) {
        allChatrooms[i].user_details = allChatrooms[i].other_user_details;
      } else {
        allChatrooms[i].user_details = allChatrooms[i].creator_details;
      }
    }
    return allChatrooms;
  },
  check_if_user_online: function (user_id) {
    Meteor.subscribe("check_if_user_online", user_id);
    return OnlineUsers.find({ user_id: user_id }).fetch();
  },
  last_message_html(html) {
    var text = htmlToText.fromString(html, {
      wordwrap: 50,
      forceWrapOnLimit: true,
    });
    if (text != null || text != undefined) {
      if (text.length > 15) {
        return text.substring(0, 15) + "...";
      } else {
        return text;
      }
    }
  },
  isReady() {
    return Session.get("isReady");
  },
  active_chatroom_id() {
    return Session.get("active_chatroom_id");
  },
  logged_in_user_id: function () {
    return Utils.getLoggedInUserId();
  },
  fetchChatroomLogId: function () {
    return (
      FlowRouter.current().params.chatroomLogId != null ||
      FlowRouter.current().params.chatroomLogId != undefined
    );
  },
});

Template.chat.onRendered(function () {
  fetchAllUserChatrooms(10, 0);
  configureRightPanelClicks();
  configureSockets();
  keepUserOnline();
  var obj = {};
  obj.user_id = Utils.getLoggedInUserId();
  obj.chatroom_id = null
  getSocketObj().emit('join_web', obj);
});

Template.chat.onDestroyed(function(){
  if(userOnlineTracker){
    clearInterval(userOnlineTracker)
  }
  AllChatroomData._collection.remove({});
  CurrentChatroomData._collection.remove({});
  socketObj.disconnect();
  socketObj =null;
})
function keepUserOnline(){
  userOnlineTracker =   setInterval(function(){
      getSocketObj().emit('emit_user_online_event', {
        user_id: Utils.getLoggedInUserId(), 
        is_online: true	
      })
  },10000);
}

async function fetchAllUserChatrooms(limit, skip) {
  if (limit == 10) {
    Session.set("notificationPlaying", false);
    Session.set("chatroomLoaded", false);
    Session.set("searchActive", false);
    Session.set("isReady", false);
    AllChatroomData._collection.remove({});
  }

  var obj = {};
  obj.user_id = Utils.getLoggedInUserId();
  obj.limit = limit;
  if (skip == 0) {
    skip = 1;
    AllChatroomData._collection.remove({});
  }
  obj.skip = skip;
  obj.query = "";
  if(FlowRouter.current().queryParams.room_query!=undefined){
    obj.query = FlowRouter.current().queryParams.room_query;
  }
  var response = await new ChatNetwork().fetchAllChatrooms(obj);
  if (Utils.isObject(response.data)) {
    if (response.data.code == 200) {
     
      if (limit == 10) {
        Session.set("chatroomLoaded", true);
        Session.set("isReady", true);
      }
      console.log(response.data);
      if (response.data.code == 200) {
        for (var i = 0; i < response.data.data.length; i++) {
          if (
            AllChatroomData._collection
              .find({ chatroom_id: response.data.data[i].chatroom_id })
              .count() == 0
          ) {
            if (response.data.data[i].is_creator) {
              response.data.data[i].user_details = response.data.data[i].other_user_details;
            } else {
              response.data.data[i].user_details = response.data.data[i].creator_details;
            }
            if(response.data.data[i].last_message_details.length!=0){
              response.data.data[i].last_message_time =  response.data.data[i].last_message_details[0].created_at;
              if(response.data.data[i].last_message_details[0].is_deleted){
                response.data.data[i].last_message = "Message deleted";
              }else{
                if(response.data.data[i].last_message_details[0].attachment_url!=undefined){
                  response.data.data[i].last_message = "<i class='fa fa-paperclip'></i> Media";  
                }else{
                  response.data.data[i].last_message = response.data.data[i].last_message_details[0].message;
                }
              } 
            }
            if (response.data.data[i].is_mute_chatroom.length != 0) {
              response.data.data[i].mute_notifications = true;
            }
            if (
              response.data.data[i].user_is_blocked_by_current_user.length != 0
            ) {
              response.data.data[i].user_blocked_by_current_user = true;
            } else if (
              response.data.data[i].user_is_blocked_by_other_user.length != 0
            ) {
              response.data.data[i].user_blocked_by_other_user = true;
            }
             
            AllChatroomData._collection.insert(response.data.data[i]);
          }
        }
        setTimeout(function(){
          Utils.loadIconsAndDropdowns();
        },2000);
      }
    } else if (response.data.code == 403) {
      PopupUtils.showErrorMessageFromJWT();
      localStorage.setItem("_id", "");
      FlowRouter.go("/signin");
    } else {
      PopupUtils.showErrorPopupWithMessage(response.data.message);
    }
  } else {
    PopupUtils.showErrorPopupWithMessage(
      ErrorMessages.getNetworkTimeoutMessage()
    );
  }
}


async function resetUnreadMessagesCount( chatroomId, user_id) {
  AllChatroomData._collection.update(
    { chatroom_id: chatroomId },
    { $set: { unread_messages: 0 } }
  );
  var allChatrooms = UnreadMessages._collection
    .find({ chatroom_id: chatroomId })
    .fetch();
  for (var i = 0; i < allChatrooms.length; i++) {
    UnreadMessages._collection.remove({ _id: allChatrooms[i].id });
  }
  var obj = {};
  obj.user_id = user_id;
  obj.chatroom_id = chatroomId;
  console.log("Calling Reset Chatroom Count APi");
  var response = await new ChatNetwork().resetChatroomCount(obj);
  console.log(response.data);
  if (Utils.isObject(response.data)) {
    if (response.data.code == 200) {
     console.log("Count resetted");
     if(response.data.user_online){
       //Emitting
       console.log("Emitting");
       getSocketObj().emit("reset_delivery_status_in_bulk", obj)
     }
    } else if (response.data.code == 403) {
      PopupUtils.showErrorMessageFromJWT();
      localStorage.setItem("_id", "");
      FlowRouter.go("/signin");
    } else {
      PopupUtils.showErrorPopupWithMessage(response.data.message);
    }
  } else {
    PopupUtils.showErrorPopupWithMessage(
      ErrorMessages.getNetworkTimeoutMessage()
    );
  }
  
}

function configureRightPanelClicks() {
  Tracker.autorun(function () {
    FlowRouter.watchPathChange();
    var chatroom_id = FlowRouter.current().params.chatroomId;
    if (chatroom_id) {
      chatroom_id = Utils.decodedEncodedString(chatroom_id);
      Session.set("active_chatroom_id", chatroom_id);
    }
  });
}

Template.chat.events({
  
  "click #search_icon_btn": function () {
    $("#search-tickets").removeClass("search-active");
  },
  "click #cross_icon_btn": function (event) {
    event.preventDefault();
    $("#search_input").val("");
    FlowRouter.setQueryParams({room_query:null});
    Session.set("search_query","");;
    $("#search-tickets").addClass("search-active");
    AllChatroomData._collection.remove({});
    fetchAllUserChatrooms(10, 0);
  },
  "keyup #search_input": function (event) {
    event.preventDefault();
    if (event.keyCode === 13) {
      event.preventDefault();
      if ($("#search_input").val().trim() == "") {
        PopupUtils.showErrorPopupWithMessage("Search cannot be empty");
      }else{
        Session.set("search_query",$("#search_input").val().trim());
        FlowRouter.setQueryParams({room_query:$("#search_input").val().trim()});
        // AllChatroomData._collection.remove({});
        // fetchAllUserChatrooms(10, 0);
      }
    }
  },
  "click .close_interest_modal": function (event) {
    event.preventDefault();
    $("#add_own_modal").click();
  },
  "click #back_arrow": function (event) {
    event.preventDefault();
    window.history.go(-1);
  },

  "click .redirect_to_chat_details": function (event) {
    event.preventDefault();
    if ($("#nav_drawer").hasClass("open")) {
      $("#nav_drawer").removeClass("open");
    } else {
     
      if( FlowRouter.current().params.chatroomId !=undefined){
        if(FlowRouter.current().params.chatroomId  == Utils.encodeString(this.chatroom_id)){
         Session.set("same",true);
        }else{
          Session.set("same",false);
          CurrentChatroomData._collection.remove({});
          LocalMessages._collection.remove({});
          redirect_to_chat_detail(this.chatroom_id, this.unread_messages)
        }
      }else{
        Session.set("same",false);
        redirect_to_chat_detail(this.chatroom_id, this.unread_messages)
      }
     
      
    }
  },
});
function redirect_to_chat_detail(chatroom_id,unread_messages){
  FlowRouter.go(
    "/chat-details/"  + Utils.encodeString(chatroom_id)
  );
  if (Session.get("replyMessage")) {
    $("#message_body").val("");
    Session.set("currentEditQuestion", undefined);
    Session.set("replyMessage", undefined);
  }
  $("#message_body").val("");
  Session.set("active_chatroom_id", chatroom_id);
  AllChatroomData._collection.update(
    { chatroom_id: chatroom_id },
    { $set: { is_active: true } }
  );
  AllChatroomData._collection.update(
    { chatroom_id: { $ne: chatroom_id } },
    { $set: { is_active: false } },
    { multi: true }
  );
  if(unread_messages!=0){
    resetUnreadMessagesCount(
      chatroom_id,
      Utils.getLoggedInUserId()
    );
  }
}