import {
  User,
  Followers,
  BlockUsers,
  AskQuestion,
  ProfileAccess,
  QueryAnswer,
} from "./../../../collections/collection.js";
import {
  ChatroomLogs,
  OnlineUsers,
  Chatroom,
  TypingUsers,
  StarredMessages,
  Messages,
  MuteChatrooms,
} from "./../../../collections/chat_collection.js";
import express from "express";
import { WebApp } from "meteor/webapp";
import md5 from "md5";
import { Utils } from "./../../../utils/utils.js";
import { result } from "underscore";

var Fiber = require("fibers");
const app = express();
app.use(express.json());

function createChatroomOrReturnExisting(currentUser, otherUser) {
  var result = {};
  if (
    Chatroom.find({
      created_by: currentUser,
      other_user_id: otherUser,
    }).count() == 0 &&
    Chatroom.find({
      created_by: otherUser,
      other_user_id: currentUser,
    }).count() == 0
  ) {
    var data = {
      chatroom_log: "chatroom_log_" + Date.now(),
      chatroom_id: "chatroom_id_" + Date.now(),
      unread_messages: 0,
      user_id: currentUser,
      is_creator: true,
      created_at: Date.now(),
    };
    ChatroomLogs.insert(data);
    data.is_creator = false;
    data.user_id = otherUser;
    ChatroomLogs.insert(data);

    var chatroomData = {};
    chatroomData.chatroom_id = data.chatroom_id;
    chatroomData.created_by = currentUser;
    chatroomData.other_user_id = otherUser;
    chatroomData.is_active = true;
    chatroomData.created_at = Date.now();
    Chatroom.insert(chatroomData);
    result.message = "New Chatroom Created";
    result.code = 200;

    result.chatroom_id = data.chatroom_id;
    result.messaging_route =
      "/chat-details/" + Utils.encodeString(data.chatroom_id);
  } else {
    var checkIfExistsChatroom = Chatroom.find({
      created_by: currentUser,
      other_user_id: otherUser,
    }).fetch();
    if (checkIfExistsChatroom.length == 0) {
      checkIfExistsChatroom = Chatroom.find({
        created_by: otherUser,
        other_user_id: currentUser,
      }).fetch();
      if (checkIfExistsChatroom.length != 0) {
        var chatroomLog = ChatroomLogs.find({
          chatroom_id: checkIfExistsChatroom[0].chatroom_id,
        }).fetch();
        if (chatroomLog.length != 0) {
          result.messaging_route =
            "/chat-details/" + Utils.encodeString(chatroomLog[0].chatroom_id);
          result.chatroom_id = chatroomLog[0].chatroom_id;
        }
      }
    } else {
      var chatroomLog = ChatroomLogs.find({
        chatroom_id: checkIfExistsChatroom[0].chatroom_id,
      }).fetch();
      if (chatroomLog.length != 0) {
        result.messaging_route =
          "/chat-details/" + Utils.encodeString(chatroomLog[0].chatroom_id);
        result.chatroom_id = chatroomLog[0].chatroom_id;
      }
    }
    result.message = "Already Chatroom Created";
    result.code = 200;
  }
  return result;
}

exports.create_room = function (req, res) {
  var follower_id = req.body.follower_id;
  var checkIfFollowerExists = Followers.find({
    follower_id: follower_id,
  }).fetch();
  if (checkIfFollowerExists.length == 1) {
    if (checkIfFollowerExists[0].status == 1) {
      result = createChatroomOrReturnExisting(
        checkIfFollowerExists[0].following_id,
        checkIfFollowerExists[0].user_id
      );
      Followers.update(
        { follower_id: follower_id },
        { $set: { messaging_route: result.messaging_route } }
      );
    } else {
      result = { code: 300, message: "Not Approved yet." };
    }
  } else {
    result = { code: 300, message: "Invalid Details provided." };
  }
  return res.status(200).send(result);
};

exports.fetch_all_chatrooms = function (req, res) {
  var user_id = req.params.user_id;
  var limit = req.query.limit;
  var skip = req.query.skip;
  var query = req.query.query;

  user_id = Utils.decodedEncodedString(user_id);
  if (user_id == undefined) {
    return res.status(200).send({ code: 300, message: "Invalid details" });
  }
  if (Utils.isInt(limit) && Utils.isInt(skip)) {
   
    if (skip == 1) skip = 0;
    if(query!=undefined){
      if(query!=""){
        query = new RegExp(query, "i");
      }
    }
    if(query == undefined){
      query = "";
    }
    // console.log(query);
    var chatrooms = Promise.await(
      ChatroomLogs.rawCollection()
        .aggregate([
          {
            $match: { user_id: user_id },
          },
          {
            $lookup: {
              from: "chatroom",
              localField: "chatroom_id",
              foreignField: "chatroom_id",
              as: "chatroom_details",
            },
          },
          {
            $addFields: {
              created_by: {
                $arrayElemAt: ["$chatroom_details.created_by", 0],
              },
            },
          },
          {
            $addFields: {
              other_user_id: {
                $arrayElemAt: ["$chatroom_details.other_user_id", 0],
              },
            },
          },

          {
            $lookup:{
                from: "user",
                   let: {user_id: "$created_by"},
                   pipeline: [
                        { $match:
                            { $expr:
                                { $and:
                                    [
                                       { $eq: ["$$user_id", "$user_id" ] },
                                    ]
                                }
                            }
                        },
                        { $addFields: { result: { $regexMatch: { input: "$name", regex: query } } } }
                    ],
                    as: "creator_details"
                }
         },

         {
          $lookup:{
              from: "user",
                 let: {user_id: "$other_user_id"},
                 pipeline: [
                      { $match:
                          { $expr:
                              { $and:
                                  [
                                     { $eq: ["$$user_id", "$user_id" ] },
                                  ]
                              }
                          }
                      },
                      { $addFields: { result: { $regexMatch: { input: "$name", regex: query } } } }
                  ],
                  as: "other_user_details"
              }
       },
          {
            $lookup:{
                from: "block_users",
                let: { chatroom_id: "$chatroom_id", user_id: user_id },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$$chatroom_id", "$chatroom_id"] },
                          { $eq: ["$$user_id", "$user_id"] }
                        ],
                      },
                    },
                  },

                ],
                as: "user_is_blocked_by_current_user",
              },
            },
            {
              $lookup:{
                  from: "block_users",
                  let: { chatroom_id: "$chatroom_id", user_id: user_id },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$$chatroom_id", "$chatroom_id"] },
                            { $eq: ["$$user_id", "$block_user"] }
                          ],
                        },
                      },
                    },
  
                  ],
                  as: "user_is_blocked_by_other_user",
                },
              },
              {
                $lookup: {
                  from: "mute_chatrooms",
                  let: {
                    chatroom_id: "$chatroom_id",
                    user_id: user_id,
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$$user_id", "$user_id"] },
                            { $eq: ["$$chatroom_id", "$chatroom_id"] },
                          ],
                        },
                      },
                    },
                  ],
                  as: "is_mute_chatroom",
                },
              },
          {
            $lookup: {
              from: "messages",
              let: { chatroom_id: "$chatroom_id", },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$$chatroom_id", "$chatroom_id"] }
                      ],
                    },
                  },
                },

                {
                  $sort: {
                    created_at: -1,
                  },
                },
                {
                  $limit:1
                }
              ],
              as: "last_message_details",
            },
          },
          {
            $project: {
              chatroom_log: 1,
              chatroom_id: 1,
              created_by:1,
              other_user_id:1,
              user_is_blocked_by_current_user:1,
              user_is_blocked_by_other_user:1,
              unread_messages: 1,
              is_mute_chatroom:1,
              last_message_details:1,
              is_creator: 1,
              last_message: 1,
              last_message_time: 1,
              created_at: 1,
              last_message_id: 1,
              updated_at: 1,
              chatroom_details: {
                created_by: 1,
                chatroom_id: 1,
                other_user_id: 1,
              },
              creator_details: {
                user_id: 1,
                name: 1,
                profile_picture: 1,
                user_name: 1,
                result:1
              },
              other_user_details: {
                user_id: 1,
                name: 1,
                profile_picture: 1,
                user_name: 1,
                result:1
              },
            },
          },
          { $match: { $or:[{'creator_details.result' : true}, {'other_user_details:result':true}] }},

          {
            $sort: {
              created_at: -1,
            },
          },
          {
            $limit: parseInt(limit),
          },
          {
            $skip: parseInt(skip),
          },
        ])
        .toArray()
    );

    return res.status(200).send({ code: 200, data: chatrooms });
  } else {
    return res.status(200).send({ code: 300, message: "Invalid details" });
  }
};

exports.fetch_chatroom_id = function (req, res) {
  var user_id = req.headers.user_id;
  var chatroom_id = req.params.chatroom_id;

  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ) {
      var chatrooms = Promise.await(
        ChatroomLogs.rawCollection()
          .aggregate([
            {
              $match: {
                chatroom_id: chatroom_id,
                user_id: user_id,
              },
            },
            {
              $lookup: {
                from: "chatroom",
                localField: "chatroom_id",
                foreignField: "chatroom_id",
                as: "chatroom_details",
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "chatroom_details.created_by",
                foreignField: "user_id",
                as: "creator_details",
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "chatroom_details.other_user_id",
                foreignField: "user_id",
                as: "other_user_details",
              },
            },
            {
              $addFields: {
                other_user_id: {
                  $arrayElemAt: ["$other_user_details.user_id", 0],
                },
              },
            },
            {
              $addFields: {
                current_user_id: {
                  $arrayElemAt: ["$creator_details.user_id", 0],
                },
              },
            },
           
            {
              $lookup:{
                  from: "block_users",
                  let: { chatroom_id: "$chatroom_id", user_id: user_id },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$$chatroom_id", "$chatroom_id"] },
                            { $eq: ["$$user_id", "$user_id"] }
                          ],
                        },
                      },
                    },
  
                  ],
                  as: "user_is_blocked_by_current_user",
                },
              },
              {
                $lookup:{
                    from: "block_users",
                    let: { chatroom_id: "$chatroom_id", user_id: user_id },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$$chatroom_id", "$chatroom_id"] },
                              { $eq: ["$$user_id", "$block_user"] }
                            ],
                          },
                        },
                      },
    
                    ],
                    as: "user_is_blocked_by_other_user",
                  },
                },
           
            {
              $lookup: {
                from: "mute_chatrooms",
                let: {
                  chatroom_id: "$chatroom_id",
                  user_id: user_id,
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$$user_id", "$user_id"] },
                          { $eq: ["$$chatroom_id", "$chatroom_id"] },
                        ],
                      },
                    },
                  },
                ],
                as: "is_mute_chatroom",
              },
            },
            {
              $project: {
                chatroom_log: 1,
                chatroom_id: 1,
                user_is_blocked_by_current_user:1,
                user_is_blocked_by_other_user:1,
                unread_messages: 1,
                is_creator: 1,
                last_message: 1,
                last_message_time: 1,
                created_at: 1,
                last_message_id: 1,
                updated_at: 1,
                is_user_blocked: 1,
                has_profile_access: 1,
                is_mute_chatroom: 1,
                having_profile_access: 1,
                chatroom_details: {
                  created_by: 1,
                  chatroom_id: 1,
                  other_user_id: 1,
                },
                creator_details: {
                  user_id: 1,
                  name: 1,
                  profile_picture: 1,
                  user_name: 1,
                },
                other_user_details: {
                  user_id: 1,
                  name: 1,
                  profile_picture: 1,
                  user_name: 1,
                },
              },
            },
          ])
          .toArray()
      );
    
      return res.status(200).send({code:200,data:chatrooms});

    }else{
      return res.status(200).send({ code: 300, message: "Invalid details" });  
    }
  } else {
    return res.status(200).send({ code: 300, message: "Invalid details" });
  }
};


exports.fetch_messages = async function (req, res) {
  var user_id = req.headers.user_id;
  var chatroom_id = req.params.chatroom_id;
  var limit = req.query.limit;
  var skip = req.query.skip;
  var queryStr = req.query.query;

  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ) {
      if (Utils.isInt(limit) && Utils.isInt(skip)) {
        if (skip == 1) skip = 0;
        var query  =  {
          chatroom_id: chatroom_id,
        };
          var checkForDeletedMessages = ChatroomLogs.find({
            user_id: user_id,
            chatroom_id: chatroom_id,
            chat_cleared:true
          }).fetch()
          if(checkForDeletedMessages.length!=0){
            query.created_at = {$gt:checkForDeletedMessages[0].cleared_at};
          }
          if(queryStr!=undefined){
            if(queryStr!=""){
              queryStr = new RegExp(queryStr, "i");
              query.message = queryStr; 
            }  
          }
                    
          // console.log(query);
        var allMesssages = await Messages.rawCollection()
          .aggregate([
            {
              $match: query
            },
            {
              $lookup: {
                from: "starred_messages",
                localField: "message_id",
                foreignField: "message_id",
                as: "starred_messages",
              },
            },
            {
              $sort: { created_at: -1 },
            },
            {
              $limit: parseInt(limit),
            },
            {
              $skip: parseInt(skip),
            },
          ])
          .toArray();
    return res.status(200).send({ code: 200, data: allMesssages });
    }else{
      return res.status(200).send({ code: 301, message: "Invalid details" });
    }
    }else{
      return res.status(200).send({ code: 302, message: "Invalid details" });  
    }
  } else {
    return res.status(200).send({ code: 303, message: "Invalid details" });
  }
};


exports.send_message = async function (req, res) {
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroomId;
 
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
      var messagingPojo = req.body;
      var chatroomDetails = Chatroom.find({
        chatroom_id: messagingPojo.chatroomId,
      }).fetch();
      var result = {};
      if (chatroomDetails.length == 1) {
        var data = {};
        data.message_id = "message_id_" + Date.now();
        data.chatroom_id = messagingPojo.chatroomId;
        if (messagingPojo.messageType == "ATTACHMENT") {
          data.attachment_url = messagingPojo.messageAttachment;
        }
        data.message = messagingPojo.message;
        data.metadata_details = messagingPojo.metadata_details;
        data.created_by = messagingPojo.user_id;
        data.message_type = messagingPojo.messageType;
        data.delivery_status = 0; 
        data.is_gif = messagingPojo.is_gif; 
        data.created_at = Date.now();
        data.is_starred = false;
        // if (messagingPojo.replied_message) {
        //   data.replied_message = messagingPojo.replied_message;
        //   data.is_replied = true;
        //   data.replied_message_data = Messages.find({
        //     message_id: data.replied_message,
        //   }).fetch();
        // }
        Messages.insert(data);
        
        var query = {
          chatroom_id: messagingPojo.chatroomId,
          user_id: messagingPojo.user_id,
        };
        ChatroomLogs.update(query, { $set: { unread_messages: 0 } });
        
        // var repliedMessage = [];
        // if (data.replied_message) {
        //   repliedMessage = data.replied_message_data;
        // }

        // check if first Message
        //check if first Message Endds
        var other_user_id; // Other User ID
        if (chatroomDetails[0].created_by == messagingPojo.user_id) {
          other_user_id = chatroomDetails[0].other_user_id;
        } else {
          other_user_id = chatroomDetails[0].created_by;
        }
        
        
        var user_online = false;

        var checkIfOnline = OnlineUsers.find({
          user_id: other_user_id,
          chatroom_id: data.chatroom_id,
        }).fetch();
        var checkIfOnlineInDifferentChatroom = OnlineUsers.find({
          user_id: other_user_id,
        }).fetch();

        var checkIfOtherUserHasMuted = MuteChatrooms.find({
              user_id: other_user_id,
              chatroom_id: data.chatroom_id,
            }).count() > 0;
        data.chatroom_muted = checkIfOtherUserHasMuted;
        if (
          checkIfOnline.length != 0
          || checkIfOnlineInDifferentChatroom.length != 0
        ) {

          user_online = true;
          
          if(checkIfOnline.length == 0){
            var increaseUnreadCount = ChatroomLogs.find({
              chatroom_id: messagingPojo.chatroomId,
              user_id: other_user_id,
            }).fetch();
            if (increaseUnreadCount.length == 1) {
              var unread_messages = increaseUnreadCount[0].unread_messages;
              ChatroomLogs.update(
                { chatroom_id: data.chatroom_id, user_id: other_user_id },
                { $set: { unread_messages: unread_messages + 1 } }
              );
              var lastMessage = "";
              if (messagingPojo.messageType == "TEXT") {
                lastMessage = messagingPojo.message;
              } else {
                lastMessage = "Sends a Media File";
              }
              
              // var fetchUserName= Users.find({user_id:messagingPojo.userId}).fetch();
              // if(fetchUserName){
              //     NotificationSender.sendPushNotification(checkIfUserIsOnline, fetchUserName[0].user_name + " sent a message",lastMessage);
              // }
            }
          }
          
        } else {
          user_online = false;
          var increaseUnreadCount = ChatroomLogs.find({
            chatroom_id: messagingPojo.chatroomId,
            user_id: other_user_id,
          }).fetch();
          if (increaseUnreadCount.length == 1) {
            var unread_messages = increaseUnreadCount[0].unread_messages;
            // console.log("Increasing the unread messages count");
            ChatroomLogs.update(
              { chatroom_id: data.chatroom_id, user_id: other_user_id },
              { $set: { unread_messages: unread_messages + 1 } }
            );
            var lastMessage = "";
            if (messagingPojo.messageType == "TEXT") {
              lastMessage = messagingPojo.message;
            } else {
              lastMessage = "Sends a Media File";
            }
            
            // var fetchUserName= Users.find({user_id:messagingPojo.userId}).fetch();
            // if(fetchUserName){
            //     NotificationSender.sendPushNotification(checkIfUserIsOnline, fetchUserName[0].user_name + " sent a message",lastMessage);
            // }
          }
  
          // temp.other_user_online = false
        }
        result.user_online = user_online;
        result.message_ = "Message inserted Successfully";
        result.data = data;
        result.code = 200;
      } else {
        result.message_ = "Something went wrong";
        result.code = 300;
      }
  
      return res.status(200).send(result);
    }else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
  }else{
    return res.status(200).send({ code: 302, message: "Invalid details" });
  }
};

exports.reset_unread_count = function(req,res){
  var query = {
    chatroom_id: req.body.chatroom_id,
    user_id: req.body.user_id,
  };
  var chatroomLogExists = ChatroomLogs.find(query).count();
  // console.log(chatroomLogExists);
  var result = {};
  if (chatroomLogExists == 0) {
    result.message = "Chatroom not found";
    result.code = 300;
  } else {
    ChatroomLogs.update(query, { $set: { unread_messages: 0 } }); //.fetch();
    var checkIfOtherUserOnline =ChatroomLogs.find({chatroom_id: query.chatroom_id,user_id:{$ne:query.user_id}}).fetch();
    if(checkIfOtherUserOnline.length==1){
     result.user_online = OnlineUsers.find({user_id:checkIfOtherUserOnline[0].user_id}).count()!=0;
    }
    result.message = "All messages read";
    result.code = 200;
  }
  return res.status(200).send(result);
};
exports.delete_message = function(req,res){
  var query = {
    message_id: req.body.message_id,
    created_by:req.body.user_id,
    chatroom_id: req.body.chatroom_id
  };
  var chatroomLogExists = Messages.find(query).count();
  var result = {};
  if (chatroomLogExists == 0) {
    result.message = "Chatroom not found";
    result.code = 300;
  } else {
    Messages.update(query, { $set: { is_deleted: true } }); //.fetch();
    var checkIfOtherUserOnline =ChatroomLogs.find({chatroom_id: query.chatroom_id,user_id:{$ne:query.created_by}}).fetch();
    if(checkIfOtherUserOnline.length==1){
     result.user_online = OnlineUsers.find({user_id:checkIfOtherUserOnline[0].user_id}).count()!=0;
    }
    result.message = "Message deleted!";
    result.code = 200;
  }
  return res.status(200).send(result);
};
//
exports.block_user = function(req,res){
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroom_id;
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
        var checkIfOtherUserOnline =ChatroomLogs.find({chatroom_id: chatroom_id,user_id:{$ne:user_id}}).fetch();
        if(checkIfOtherUserOnline.length==1){
          var query = {
            user_id: user_id,
            block_user: checkIfOtherUserOnline[0].user_id,
            chatroom_id: chatroom_id,  
          };
          
          var checkIfAnyRequest = BlockUsers.find(query).fetch();
          if(checkIfAnyRequest.length == 0){
            query.created_at  = Date.now();
            BlockUsers.insert(query);
            var user_online = OnlineUsers.find({user_id:checkIfOtherUserOnline[0].user_id}).count()!=0;

            return res.status(200).send({ code: 200, message: "User Blocked!",user_online:user_online }); 
          }else{
            return res.status(200).send({ code: 201, message: "User already Blocked" });  
          }
        }else{
          return res.status(200).send({ code: 301, message: "Invalid details" });
        }
    }else{
      return res.status(200).send({ code: 302, message: "Invalid details" });
    }
  }else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
};
//
exports.unblock_user = function(req,res){
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroom_id;
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
      // console.log('chatroom_id:' + chatroom_id);
      // console.log('user_id:' + user_id );
        var checkIfOtherUserOnline =ChatroomLogs.find({chatroom_id: chatroom_id,user_id:{$ne:user_id}}).fetch();
        if(checkIfOtherUserOnline.length==1){
            var query = {
              user_id: user_id,
              block_user: checkIfOtherUserOnline[0].user_id,
              chatroom_id: chatroom_id,  
            };
            BlockUsers.remove(query);
            var user_online = OnlineUsers.find({user_id:checkIfOtherUserOnline[0].user_id}).count()!=0;
            return res.status(200).send({ code: 200, message: "User unBlocked!",user_online:user_online }); 
          }else{
            return res.status(200).send({ code: 201, message: "Invalid details" });  
          }
        }else{
          return res.status(200).send({ code: 301, message: "Invalid details" });
        }
      } else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
};

exports.mute_notifications = function(req,res){
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroom_id;
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
      if(req.body.enable_mute){
        var checkIfAlreadyMuted = MuteChatrooms.find({user_id: user_id, chatroom_id: chatroom_id}).fetch(); 
        if(checkIfAlreadyMuted.length == 0){
          MuteChatrooms.insert({
            user_id: user_id,
            chatroom_id: chatroom_id,
            created_at: Date.now(),
          });
          return res.status(200).send({ code: 200, message: "Notifications Muted!" });
        }else{
          return res.status(200).send({ code: 201, message: "Already  Muted!" });
        }
      }else{
        var checkIfAlreadyMuted = MuteChatrooms.find({user_id: user_id, chatroom_id: chatroom_id}).fetch(); 
        if(checkIfAlreadyMuted.length == 1){
          MuteChatrooms.remove({
            user_id: user_id,
            chatroom_id: chatroom_id,
          });
          return res.status(200).send({ code: 200, message: "Notifications unmuted!" });
        }else{
          return res.status(200).send({ code: 201, message: "Already  Unmuted!" });
        }
      }
        
        }else{
          return res.status(200).send({ code: 301, message: "Invalid details" });
        }
      } else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
};

exports.clear_chat = function(req,res){
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroom_id;
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
      
      if(ChatroomLogs.find({ user_id: user_id, chatroom_id: chatroom_id}).count() != 0 ){
        ChatroomLogs.update({ user_id: user_id, chatroom_id: chatroom_id},{$set:{chat_cleared:true, cleared_at:Date.now()}});
      }
      return res.status(200).send({ code: 200, message: "Chatroom cleared" });
      
     }else{
        return res.status(200).send({ code: 301, message: "Invalid details" });
     }
    } else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
};


exports.update_message = function(req,res){
  var user_id = req.headers.user_id;
  var chatroom_id = req.body.chatroom_id;
  if (chatroom_id && user_id) {
    if (
      Chatroom.find({
        created_by: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0 ||
      Chatroom.find({
        other_user_id: user_id,
        chatroom_id: chatroom_id,
      }).count() != 0
    ){
      
      // console.log(req.body);
    
      Messages.update(
        { message_id: req.body.message_id },
        { $set: { message: req.body.message, attachment_url:req.body.messageAttachment, is_edited: true } }
      );
      var checkIfOtherUserOnline =ChatroomLogs.find({chatroom_id: chatroom_id,user_id:{$ne:user_id}}).fetch();
      var user_online = false;
      if(checkIfOtherUserOnline.length==1){        
         user_online = OnlineUsers.find({user_id:checkIfOtherUserOnline[0].user_id}).count()!=0;
      }
        var result = {};
      result.message = "Message updated Successfully";
      result.code = 200;
      result.user_online = user_online;
      return res.status(200).send(result);
     }else{
        return res.status(200).send({ code: 301, message: "Invalid details" });
     }
    } else{
      return res.status(200).send({ code: 303, message: "Invalid details" });
    }
};

app.post("/update_message_delivery_status", (req, res) => {
  Fiber(function () {
    var messageId = req.body.message_id;
    var chatroomId = req.body.chatroom_id;

    var checkIfMessageExists = Messages.find({ message_id: messageId }).fetch();
    var result = {};
    if (checkIfMessageExists.length == 1) {
      // fetch all users with this chatroom who are online then

      var fetchChatroom = Chatroom.find({ chatroom_id: chatroomId }).fetch();
      // io.on('connection',function(socket){
      //   socket.broadcast.emit('update_message_status',messageId,chatroomId);
      // });
      // chatStream.emit("update_message_status", messageId, chatroomId);
      Messages.update(
        { message_id: messageId },
        { $set: { delivery_status: 1 } }
      );
      result.message = "Message status changed successfully";
      result.code = 200;
      return res.status(200).send(result);
    } else {
      result.message = "Message not found";
      result.code = 300;
      return res.status(200).send(result);
    }
  }).run();
});

app.post("/update_message_star_status", (req, res) => {
  Fiber(function () {
    var messageId = req.body.message_id;
    var userId = req.body.user_id;
    var chatroomId = req.body.chatroom_id;
    var is_starred = req.body.is_starred;

    var checkIfMessageExists = Messages.find({ message_id: messageId }).fetch();
    var result = {};
    if (checkIfMessageExists.length == 1) {
      // chatStream.emit('update_star_message_status',messageId,chatroomId,is_starred);
      // Messages.update({message_id:messageId},{$set:{is_starred:is_starred}});
      var checkIfExists = StarredMessages.find({
        message_id: messageId,
        created_by: userId,
      }).fetch();
      if (is_starred) {
        if (checkIfExists.length == 0) {
          StarredMessages.insert({
            starred_message_id: "starred_message_id_" + Date.now(),
            message_id: messageId,
            created_by: userId,
            chatroom_id: chatroomId,
            is_active: true,
            created_at: Date.now(),
          });
        } else if (checkIfExists.length == 1) {
          if (!checkIfExists[0].is_active) {
            StarredMessages.update(
              { starred_message_id: checkIfExists[0].starred_message_id },
              { $set: { is_active: true } }
            );
          }
        }
      } else if (checkIfExists.length == 1) {
        StarredMessages.update(
          { starred_message_id: checkIfExists[0].starred_message_id },
          { $set: { is_active: false } }
        );
      }
      result.message = "Message status changed successfully";
      result.code = 200;
      return res.status(200).send(result);
    } else {
      result.message = "Message not found";
      result.code = 300;
      return res.status(200).send(result);
    }
  }).run();
});

app.post("/update_connection_message_status", (req, res) => {
  Fiber(function () {
    var messageId = req.body.message_id;

    var checkIfMessageExists = Messages.find({ message_id: messageId }).fetch();
    var result = {};
    if (checkIfMessageExists.length == 1) {
      // chatStream.emit(
      //   "change_connection_request_status",
      //   messageId,
      //   req.body.request_accepted
      // );
      Messages.update(
        { message_id: messageId },
        {
          $set: {
            action_taken: true,
            request_accepted: req.body.request_accepted,
          },
        }
      );
      result.message = "Message status changed successfully";
      result.code = 200;
      return res.status(200).send(result);
    } else {
      result.message = "Message not found";
      result.code = 300;
      return res.status(200).send(result);
    }
  }).run();
});



app.post("/fetch_all_starred_messages", (req, res) => {
  Fiber(async function () {
    var chatroom_id = req.body.chatroom_id;
    var user_id = req.body.user_id;
    var allMesssages = await StarredMessages.rawCollection()
      .aggregate([
        {
          $match: {
            chatroom_id: chatroom_id,
            created_by: user_id,
            is_active: true,
          },
        },
        {
          $lookup: {
            from: "messages",
            localField: "message_id",
            foreignField: "message_id",
            as: "message_details",
          },
        },
        {
          $sort: { created_at: -1 },
        },
      ])
      .toArray();
    return res.status(200).send({ code: 200, messages: allMesssages });
  }).run();
});

app.post("/request_for_profile_access_", (req, res) => {
  Fiber(function () {
    var checkIfAnyRequest = ProfileAccess.find({
      user_id: req.body.user_id, //User you want the access of
      request_from: req.body.requested_from, // Requester
      status: 0,
    }).fetch();
    // console.log("checkIfAnyRequest");
    // console.log(checkIfAnyRequest);
    if (checkIfAnyRequest.length == 0) {
      var query = {
        user_id: req.body.user_id,
        request_from: req.body.requested_from,
        status: 0,
        created_at: Date.now(),
      };
      ProfileAccess.insert(query);

      return res
        .status(200)
        .send({ code: 200, message: "Profile access request sent" });
    } else {
      return res.status(200).send({
        code: 300,
        message: "Profile access already sent, cannot be sent again",
      });
    }
  }).run();
});

app.post("/check_if_user_have_profile_access", (req, res) => {
  Fiber(function () {
    // var checkIfAnyRequest = ProfileAccess.find({user_id : req.body.user_id, request_from: req.body.requested_from,status:0}).fetch();
    var user_id = req.body.user_id;
    var other_user_id = req.body.requested_from;
    var checkForProfileAccess = ProfileAccess.find({
      $or: [
        { user_id: user_id, request_from: other_user_id, status: 1 },
        { user_id: other_user_id, request_from: user_id, status: 1 },
      ],
    }).fetch();

    if (checkForProfileAccess.length == 0) {
      return res
        .status(200)
        .send({ code: 300, message: "Profile access not approved" });
    } else {
      return res
        .status(200)
        .send({ code: 200, message: "Profile access approved" });
    }
  }).run();
});

app.post("/request_for_block_user", (req, res) => {
  Fiber(function () {
    // console.log(req.body);
    var checkIfAnyRequest = BlockUser.find({
      user_id: req.body.user_id,
      block_user: req.body.blocked_user,
      is_active: true,
    }).fetch();
    if (checkIfAnyRequest.length == 0) {
      var query = {
        user_id: req.body.user_id,
        block_user: req.body.blocked_user,
        is_active: true,
        created_at: Date.now(),
      };
      var block = BlockUser.insert(query);
      return res
        .status(200)
        .send({ code: 200, message: "Block Request request sent" });
    } else {
      return res
        .status(200)
        .send({ code: 300, message: "Already Blocked, cannot be block again" });
    }
  }).run();
});

app.post("/check_if_user_have_profile_access_mobile", (req, res) => {
  Fiber(function () {
    // var checkIfAnyRequest = ProfileAccess.find({user_id : req.body.user_id, request_from: req.body.requested_from,status:0}).fetch();
    var user_id = req.body.other_user_id;
    var other_user_id = req.body.user_id;
    var checkForProfileAccess = ProfileAccess.find({
      user_id: user_id,
      request_from: other_user_id,
    }).fetch();

    if (checkForProfileAccess.length == 0) {
      return res
        .status(200)
        .send({ code: 300, message: "Profile access not sent" });
    } else {
      return res
        .status(200)
        .send({
          code: 200,
          message: "Profile access sent earlier",
          is_accepted: checkForProfileAccess[0].status,
        });
    }
  }).run();
});

app.post("/check_if_user_blocked_mobile", (req, res) => {
  Fiber(function () {
    var user_id = req.body.user_id;
    var other_user_id = req.body.other_user_id;
    var checkIfBlocked = BlockUser.find({
      $or: [
        { user_id: user_id, block_user: other_user_id },
        { user_id: other_user_id, block_user: user_id },
      ],
    }).fetch();
    if (checkIfBlocked.length == 0) {
      return res.status(200).send({ code: 300, message: "Not Blocked" });
    } else {
      return res
        .status(200)
        .send({
          code: 200,
          message: "User Blocked",
          blocked_details: checkIfBlocked,
        });
    }
  }).run();
});
app.post("/update_profile_request", (req, res) => {
  Fiber(function () {
    if (req.body.is_accecpted) {
      var checkIfAnyRequest = ProfileAccess.find({
        user_id: req.body.user_id,
        request_from: req.body.requested_from,
        status: 0,
      }).fetch();
      if (checkIfAnyRequest.length != 0) {
        // console.log("updating");
        ProfileAccess.update(
          { user_id: req.body.user_id, request_from: req.body.requested_from },
          { $set: { status: 1, updated_at: Date.now() } }
        );
        // Messages.update({message_id: req.body.message_id},{$set:{is_accepted:true}});
      } else {
        // console.log("user_id");
        // console.log(req.body.user_id);
        // console.log("requested_from");
        // console.log(req.body.requested_from);
      }
    } else {
      ProfileAccess.remove({
        user_id: req.body.user_id,
        request_from: req.body.requested_from,
        status: 0,
      });
      // Messages.update({message_id: req.body.message_id},{$set:{is_accepted:false}});
    }
    // chatStream.emit(
    //   "change_connection_request_status",
    //   req.body.message_id,
    //   req.body.is_accecpted
    // );
    Messages.update(
      { message_id: req.body.message_id },
      { $set: { action_taken: true, request_accepted: req.body.is_accecpted } }
    );
    return res
      .status(200)
      .send({ code: 200, message: "Profile access updated" });
  }).run();
});

app.post("/check_user_typing", (req, res) => {
  Fiber(function () {
    if (req.body.is_typing) {
      var checkIfAnyRequest = TypingUsers.find({
        user_id: req.body.user_id,
        chatroom_id: req.body.chatroom_id,
      }).fetch();
      if (checkIfAnyRequest.length == 0) {
        TypingUsers.insert({
          user_id: req.body.user_id,
          chatroom_id: req.body.chatroom_id,
          created_at: Date.now(),
        });
      }
    } else {
      var checkIfAnyRequest = TypingUsers.find({
        user_id: req.body.user_id,
        chatroom_id: req.body.chatroom_id,
      }).fetch();
      for (var i = 0; i < checkIfAnyRequest.length; i++) {
        TypingUsers.remove({ _id: checkIfAnyRequest[i]._id });
      }
    }
    return res
      .status(200)
      .send({ code: 200, message: "Typing status updated successfully" });
  }).run();
});

app.post("/mute_chatroom_notification", (req, res) => {
  Fiber(function () {
    if (req.body.enable_mute) {
      var checkIfAnyRequest = MuteChatrooms.find({
        user_id: req.body.user_id,
        chatroom_id: req.body.chatroom_id,
      }).fetch();
      if (checkIfAnyRequest.length == 0) {
        MuteChatrooms.insert({
          user_id: req.body.user_id,
          chatroom_id: req.body.chatroom_id,
          created_at: Date.now(),
        });
      }
    } else {
      MuteChatrooms.remove({
        user_id: req.body.user_id,
        chatroom_id: req.body.chatroom_id,
      });
    }
    return res.status(200).send({
      code: 200,
      message: "Chatroom mute status updated successfully",
    });
  }).run();
});

app.post("/fetch_user_information_details", (req, res) => {
  Fiber(function () {
    var userDetails = User.find({ user_id: req.body.user_id }).fetch();
    var details = {};
    if (userDetails.length != 0) {
      details.email = userDetails[0].email;
    }

    return res.status(200).send({
      code: 200,
      message: "successfullly retrieved",
      details: details,
    });
  }).run();
});

WebApp.connectHandlers.use(app);

function parseBool(str) {
  if (str.length == null) {
    return str == 1 ? true : false;
  } else {
    return str == "true" ? true : false;
  }
}

Meteor.methods({
  update_unread_count_in_the_database: function (chatroomPojo) {
    var query = {
      chatroom_log: chatroomPojo.chatroomLogId,
      chatroom_id: chatroomPojo.chatroomId,
      is_creator: parseBool(chatroomPojo.creator),
      user_id: chatroomPojo.currentUserId,
    };
    var chatroomLogExists = ChatroomLogs.find(query).count();
    var result = {};
    if (chatroomLogExists == 0) {
      result.message = "Chatroom not found--------------------";
      // // console.log("Chatroom Not found");
      // // console.log(chatroomPojo);
      // // console.log("Chatroom Not found");
      result.code = 300;
    } else {
      var chatroomLogExists = ChatroomLogs.find(query).fetch();
      var chatroomLogId = ChatroomLogs.update(query, {
        $set: { unread_messages: chatroomPojo.unreadCount },
      });
      // // console.log("is chatroom Updated: " + chatroomLogId);
      // // console.log(chatroomLogExists);
      result.message = "Chatroom unread count updated";
      result.code = 200;
    }
    return result;
  },
  update_message_delivery_status: function (messageId, chatroomId, delivery) {
    var checkIfMessageExists = Messages.find({ message_id: messageId }).fetch();
    var result = {};
    if (checkIfMessageExists.length == 1) {
      var fetchChatroom = Chatroom.find({ chatroom_id: chatroomId }).fetch();
      // chatStream.emit("update_message_status", messageId, chatroomId);
      Messages.update(
        { message_id: messageId },
        { $set: { delivery_status: 1 } }
      );
      result.message = "Message status changed successfully";
      result.code = 200;
    } else {
      result.message = "Message not found";
      result.code = 300;
    }
    return result;
  },

  reset_unread_messages: function (chatroomPojo) {
    var query = {
      chatroom_log: chatroomPojo.chatroomLogId,
      chatroom_id: chatroomPojo.chatroomId,
      is_creator: parseBool(chatroomPojo.creator),
      user_id: chatroomPojo.currentUserId,
    };
    // console.log("Resetting unread Messages");
    // console.log(query);
    var chatroomLogExists = ChatroomLogs.find(query).count();
    var result = {};
    if (chatroomLogExists == 0) {
      result.message = "Chatroom not found";
      result.code = 300;
    } else {
      ChatroomLogs.update(query, { $set: { unread_messages: 0 } }); //.fetch();
      var fetchAllUnreadMessages = Messages.find({
        chatroom_id: chatroomPojo.chatroomId,
        delivery_status: 0,
      }).fetch();
      for (var i = 0; i < fetchAllUnreadMessages.length; i++) {
        var chatroomDetails = Chatroom.find({
          chatroom_id: chatroomPojo.chatroomId,
        }).fetch();
        var userDetails;
        if (chatroomDetails.length == 1 && query.is_creator) {
          userDetails = User.find({
            user_id: chatroomDetails[0].other_user_id,
          }).fetch();
        } else {
          userDetails = User.find({
            user_id: chatroomDetails[0].created_by,
          }).fetch();
        }

        // if(userDetails.length == 1 && userDetails[0].online_status==1){
        // chatStream.emit(
        //   "update_message_status",
        //   fetchAllUnreadMessages[i].message_id,
        //   chatroomPojo.chatroomId
        // );
        // }
        // Delivery Status Updated;
        Messages.update(
          { message_id: fetchAllUnreadMessages[i].message_id },
          { $set: { delivery_status: 1 } }
        );
      }
      result.message = "All messages read";
      result.code = 200;
    }
    // console.log(result);
    return result;
  },
  update_user_online_status_based_on_connection: function (connection_id) {
    var checkIfUserExists = User.find({ connection_id: connection_id }).fetch();
    var result = {};
    if (checkIfUserExists.length == 1) {
      User.update(
        { user_id: checkIfUserExists[0].user_id },
        {
          $set: { online_status: 0, connection_id: "", updated_at: Date.now() },
        }
      );
      result.message = "status changed successfully";
      result.user_id = checkIfUserExists[0].user_id;
      result.code = 200;
    } else {
      result.message = "User not found";
      result.code = 300;
    }
    return result;
  },
  update_user_online_status: function (user_id, status) {
    var checkIfUserExists = User.find({ user_id: user_id }).fetch();
    var result = {};
    if (checkIfUserExists.length == 1) {
      // // console.log("Updating User Online Status");
      // // console.log(status);
      // chatStream.emit("change_user_online_status",user_id,status);
      // User.update({user_id:checkIfUserExists[0].user_id},{$set:{online_status:status,updated_at:Date.now()}});
      if (status == 1) {
        var checkIfOnline = OnlineUsers.find({ user_id: user_id }).fetch();
        if (checkIfOnline.length == 0) {
          OnlineUsers.insert({ user_id: user_id, created_at: Date.now() });
        }
      } else {
        //  OnlineUsers.remove({user_id:user_id})
        var checkIfOnline = OnlineUsers.find({ user_id: user_id }).fetch();
        for (var i = 0; i < checkIfOnline.length; i++) {
          OnlineUsers.remove({ _id: checkIfOnline[i]._id });
        }
      }
      result.message = "status changed successfully";
      result.user_id = checkIfUserExists[0].user_id;
      result.code = 200;
    } else {
      result.message = "User not found";
      result.code = 300;
    }
    return result;
  },
  update_user_online_status_with_chatroom_id: function (
    user_id,
    status,
    chatroom_id
  ) {
    var checkIfUserExists = User.find({ user_id: user_id }).fetch();
    var result = {};
    if (checkIfUserExists.length == 1) {
      if (status == 1) {
        var checkIfOnline = OnlineUsers.find({ user_id: user_id }).fetch();
        if (checkIfOnline.length != 0) {
          OnlineUsers.update(
            { user_id: user_id },
            { $set: { chatroom_id: chatroom_id } },
            { multi: true }
          );
        } else {
          OnlineUsers.insert({
            user_id: user_id,
            chatroom_id: chatroom_id,
            created_at: Date.now(),
          });
        }
      } else {
        var checkIfOnline = OnlineUsers.find({ user_id: user_id }).fetch();
        for (var i = 0; i < checkIfOnline.length; i++) {
          OnlineUsers.remove({ _id: checkIfOnline[i]._id });
        }
      }
      result.message = "status changed successfully";
      result.user_id = checkIfUserExists[0].user_id;
      result.code = 200;
    } else {
      result.message = "User not found";
      result.code = 300;
    }
    return result;
  },
  update_user_online_status_with_connection_id: function (
    user_id,
    connection_id
  ) {
    var checkIfUserExists = User.find({ user_id: user_id }).fetch();
    var result = {};
    if (checkIfUserExists.length == 1) {
      // console.log("Updating User Online Status");
      // console.log(user_id);
      // console.log(connection_id);
      // chatStream.emit("change_user_online_status",user_id,status);
      // User.update({user_id:checkIfUserExists[0].user_id},{$set:{online_status:status,updated_at:Date.now()}});
      User.update(
        { user_id: checkIfUserExists[0].user_id },
        { $set: { connection_id: connection_id, updated_at: Date.now() } }
      );
      OnlineUsers.insert({
        user_id: user_id,
        connection_id: connection_id,
        created_at: Date.now(),
      });

      result.message = "status changed successfully";
      result.user_id = checkIfUserExists[0].user_id;
      result.code = 200;
    } else {
      result.message = "User not found";
      result.code = 300;
    }
    return result;
  },
});

Meteor.publish("fetch_all_messages", function (chatroom_id, limit) {
  var allMesssages = Messages.find(
    { chatroom_id: chatroom_id },
    { sort: { created_at: -1 }, limit: limit }
  ).fetch();
  var self = this;
  _.each(allMesssages, function (doc) {
    var objId = new Meteor.Collection.ObjectID();
    // self.added('messages',doc._id, doc);
    self.added("messages", objId, doc);
  });
  self.ready();
});

Meteor.publish("fetch_all_user_chatrooms", function (user_id) {
  var allChatroomData = Promise.await(
    ChatroomLogs.rawCollection()
      .aggregate([
        {
          $match: {
            user_id: user_id,
          },
        },
        {
          $lookup: {
            from: "chatroom",
            localField: "chatroom_id",
            foreignField: "chatroom_id",
            as: "chatroom_details",
          },
        },
        {
          $lookup: {
            from: "user",
            localField: "chatroom_details.created_by",
            foreignField: "user_id",
            as: "creator_details",
          },
        },
        {
          $lookup: {
            from: "user",
            localField: "chatroom_details.other_user_id",
            foreignField: "user_id",
            as: "other_user_details",
          },
        },
      ])
      .toArray()
  );

  var self = this;
  _.each(allChatroomData, function (doc) {
    self.added("all_chatroom_data", doc._id, doc);
  });
  self.ready();
});

Meteor.publish(
  "fetch_chatroom_details",
  function (chatroom_log, chatroom_id, user_id) {
    var allChatroomData = Promise.await(
      ChatroomLogs.rawCollection()
        .aggregate([
          {
            $match: {
              chatroom_log: chatroom_log,
              chatroom_id: chatroom_id,
              user_id: user_id,
            },
          },
          {
            $lookup: {
              from: "chatroom",
              localField: "chatroom_id",
              foreignField: "chatroom_id",
              as: "chatroom_details",
            },
          },
          {
            $lookup: {
              from: "user",
              localField: "chatroom_details.created_by",
              foreignField: "user_id",
              as: "creator_details",
            },
          },
          {
            $lookup: {
              from: "user",
              localField: "chatroom_details.other_user_id",
              foreignField: "user_id",
              as: "other_user_details",
            },
          },
        ])
        .toArray()
    );

    var self = this;
    _.each(allChatroomData, function (doc) {
      self.added("current_chatroom_data", doc._id, doc);
    });
    self.ready();
  }
);

Meteor.publish("check_if_message_is_starred", function (message_id, user_id) {
  return StarredMessages.find({
    message_id: message_id,
    created_by: user_id,
    is_active: true,
  });
});

Meteor.publish(
  "check_if_user_is_connection",
  function (user_id, other_user_id) {
    return Followers.find({
      $or: [
        { user_id: user_id, is_active: true, follower_of: other_user_id },
        { user_id: other_user_id, is_active: true, follower_of: user_id },
      ],
    });
  }
);

Meteor.publish(
  "check_if_profile_request_exists",
  function (user_id, other_user_id) {
    return ProfileAccess.find({
      $or: [
        { user_id: user_id, request_from: other_user_id },
        { user_id: other_user_id, request_from: user_id },
      ],
    });
  }
);

Meteor.publish("check_if_blocked", function (user_id, other_user_id) {
  return BlockUser.find({
    $or: [
      { user_id: user_id, block_user: other_user_id },
      { user_id: other_user_id, block_user: user_id },
    ],
  });
});

Meteor.publish("check_if_chatroom_mute", function (user_id, chatroom_id) {
  return MuteChatrooms.find({ user_id: user_id, chatroom_id: chatroom_id });
});
Meteor.publish("check_if_user_typing", function (user_id, chatroom_id) {
  return TypingUsers.find({ user_id: user_id, chatroom_id: chatroom_id });
});

Meteor.publish("check_if_user_online", function (user_id) {
  // console.log("Online Users", user_id);
  return OnlineUsers.find({ user_id: user_id });
});

// .then(function(result) {
//            )
// var fetchAllChatrooms = ChatroomLogs.find({user_id:user_id},{sort:{last_message_time: -1}}).fetch();
// var allChatroomData = [];
// for(var i=0;i<fetchAllChatrooms.length;i++){
//     var chatroomDetails = Chatroom.find({chatroom_id:fetchAllChatrooms[i].chatroom_id}).fetch();
//     var userDetails;
//     if(chatroomDetails.length == 1 && fetchAllChatrooms[i].is_creator){
//         userDetails = Users.find({user_id: chatroomDetails[0].other_user_id}).fetch();
//     }else{
//         userDetails = Users.find({user_id: chatroomDetails[0].created_by}).fetch();
//     }
//     // // console.log('userDetails');

//     // // console.log(userDetails);

//     var unreadMessagesCount = ChatroomLogs.find({user_id:user_id,is_creator:fetchAllChatrooms[i].is_creator}).fetch();
//     var objId = new Meteor.Collection.ObjectID();

//     var data = {
//         _id: fetchAllChatrooms[i].chatroom_id,
//         other_user_id:userDetails[0].user_id,
//         user_name:userDetails[0].user_name,
//         profile_image:userDetails[0].profile_image,
//         online_status:userDetails[0].online_status,
//         unread_messages:fetchAllChatrooms[i].unread_messages,
//         chatroom_id:fetchAllChatrooms[i].chatroom_id,
//         chatroom_log:fetchAllChatrooms[i].chatroom_log,
//         is_creator:fetchAllChatrooms[i].is_creator,
//         is_blocked:fetchAllChatrooms[i].is_blocked,
//         blocked_by:fetchAllChatrooms[i].blocked_by,
//         last_message:fetchAllChatrooms[i].last_message,
//         last_message_time:fetchAllChatrooms[i].last_message_time,
//     }
//     allChatroomData.push(data);
