
import {LoggedInUser,User,Followers,CommittedAthletes,SignedAthletes,Group, GroupMember, Blogs, PlatformSettings} from './../collections/collection';
import { Base64 } from 'meteor/ostrio:base64';
import { Utils } from '../utils/utils';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

const htmlToText = require('html-to-text');

Template.registerHelper("increment_by_value" , function(actual_value,incremented_value){
  return actual_value+incremented_value;
})

Template.registerHelper("check_if_uploading_going_on",function(){
  return Session.get("check_if_uploading_going_on")
})
Template.registerHelper("decode_string",function(str){
  return Utils.encodeString(str);
})

Template.registerHelper("check_multiple",function(a,b){
  return (a!=undefined && a!="" ) && (b!=undefined && b!="") 
})
Template.registerHelper("divide_by_2",function(a){
  return a/2; 
})
Template.registerHelper("trim_by_comma",function(a){
  a  = a.split(",");
  if(a.length>2){
    return a[a.length-2] + ", " + a[a.length-1]
  }else{
    return a 
  }
  
});

Template.registerHelper("format_currency",function(num){
  return "₹" +  num;
  // return Math.abs(num) > 999 ? Math.sign(num)*((Math.abs(num)/1000).toFixed(1)) + 'k' : Math.sign(num)*Math.abs(num)
})
Template.registerHelper("get_array_length",function(array){
  return array.length;
})
Template.registerHelper("equals_two_parameter",function(a,b,c){
  return a==b || a==c;
})

Template.registerHelper("fetch_platform_logo",function(){
  var getPlatformDetails = PlatformSettings.find({type:"logo"}).fetch();
  if(getPlatformDetails.length!=0){
    return getPlatformDetails;
  }else{
    return [];
  }
  
});
Template.registerHelper('check_if_current_path_is_feed',function(){
  return FlowRouter.current().path == "/feed" ||  FlowRouter.current().path ==  "/athlete-feed" || 
        FlowRouter.current().path == "/referee-feed" || FlowRouter.current().path == "/retired-feed"
        || FlowRouter.current().path == "/association-feed";
  
})

Template.registerHelper('fetch_logged_in_user',function(){
  let data = LoggedInUser.find({},{limit:1}).fetch()
  return data;
})
Template.registerHelper('fetch_all_published_blogs',function(user_id){
  Meteor.subscribe("fetch_all_published_blogs",user_id);
  let data = Blogs.find({user_id:user_id,status:true}).count()
  return data;
})
Template.registerHelper('user_role',function(){
  return Session.get("role");
})
Template.registerHelper('current_logged_in_user_role',function(){
  return Session.get("role");
})
Template.registerHelper('fetch_all_groups_created_by_user',function(user_id){
    Meteor.subscribe("fetch_all_groups_created_by_user", user_id);
    return Group.find({created_by:user_id, is_active:true}).count()
})

Template.registerHelper('fetch_all_groups_where_user_is_member',function(user_id){
    Meteor.subscribe("fetch_all_groups_where_user_is_member", user_id);
    return GroupMember.find({user_id:user_id, status:1}).count()
})

Template.registerHelper('logged_in_user_id',function(){
  return Utils.getLoggedInUserId();;
})
Template.registerHelper('equals_multiple',function(user_type){
  if(user_type){  
  return user_type == Utils.getCoachUserProfile() || user_type == Utils.getRefreeProfile();
  }
})

Template.registerHelper('equals_multiple_coach_athlete',function(user_type){
  if(user_type){  
  return user_type == Utils.getCoachUserProfile() || user_type == Utils.getAthleteProfile();
  }
})

Template.registerHelper('equals_multiple_coach_athlete_referee',function(user_type){
  if(user_type){  
  return user_type == Utils.getCoachUserProfile() ||user_type == Utils.getAthleteProfile() || user_type == Utils.getRefreeProfile();
  }
})
Template.registerHelper('fetch_created_by',function(user_id){
  Meteor.subscribe("fetch_user_details", user_id);
    var userDetails = User.find({user_id:user_id}).fetch()
    if(userDetails[0]){
      return userDetails[0].name;
    }

})

function getCorrectUserId(){
  var user_id = "";
  if(FlowRouter.current().params.id != undefined){
    user_id = Utils.decodedEncodedString(FlowRouter.current().params.id);
  }else{
    user_id = Utils.getLoggedInUserId();
  }
  return user_id;
}
Template.registerHelper('fetch_total_user_connections',function(){
  Meteor.subscribe("fetch_total_user_connections",getCorrectUserId() )
 return  Followers.find({$and:[{  $or: [{ follower_of: getCorrectUserId()}, 
                                { user_id : getCorrectUserId()}  ], }
                                  ,{status:1},
                                  { is_active:true },
                                  {user_type: Utils.getGenericUserType()} 
                                ], }).count();
})

Template.registerHelper('fetch_all_user_following',function(){
  Meteor.subscribe("fetch_all_user_following", getCorrectUserId());
  var allFollowers =   Followers.find({ user_id : getCorrectUserId(), user_type: Utils.getAssociationProfile(), is_active:true , status:1}).fetch();//.fetch();              
  var total_followers = 0;
  for(var i=0;i<allFollowers.length;i++){
      if(allFollowers[i].req_status !=0 && !allFollowers[i].request_sent_by_me){
          total_followers++;
      }
  }

  return total_followers; 
})
Template.registerHelper('fetch_all_user_following_association',function(){
  Meteor.subscribe("fetch_all_user_following_association", getCorrectUserId());
  var allFollowers =   Followers.find({ follower_of : getCorrectUserId(), user_type: Utils.getAssociationProfile(), is_active:true,status:1 }).fetch();              
  var total_followers = 0;
  for(var i=0;i<allFollowers.length;i++){
      if(allFollowers[i].req_status !=0 && !allFollowers[i].request_sent_by_me){
          total_followers++;
      }
  }

  return total_followers; 
})
Template.registerHelper('fetch_all_user_followers',function(){
  Meteor.subscribe("fetch_all_user_followers", getCorrectUserId());
  var allFollowers =   Followers.find({ follower_of : getCorrectUserId(), user_type: Utils.getAssociationProfile(), is_active:true , status:1}).fetch();//.fetch();              
  var total_followers = 0;
  for(var i=0;i<allFollowers.length;i++){
      if(allFollowers[i].req_status !=0 && !allFollowers[i].request_sent_by_me){
          total_followers++;
      }
  }

  return total_followers; 
})

Template.registerHelper('fetch_all_committed_athletes_count',function(){
  Meteor.subscribe("fetch_all_committed_athletes", getCorrectUserId());
  var allFollowers =  CommittedAthletes.find({
    $and: [{
            'is_active': true
        },
        {
            is_accepted:true
        },
        {
            committed_to: getCorrectUserId()
        },
    ]
    }).count();  

  return allFollowers; 
})
Template.registerHelper('fetch_all_signed_athletes_count',function(){
  Meteor.subscribe("fetch_all_signed_athletes", getCorrectUserId());
  var allFollowers =   SignedAthletes.find({
    $and: [{
            'is_active': true
        },
        {
            is_accepted:true
        },
        {
            committed_to: getCorrectUserId()
        },
    ]
}).count();

  return allFollowers; 
})

Template.registerHelper("facebook_sharing_link_with_type",function(type){
  if(type =="event"){
      return "https://www.facebook.com/sharer/sharer.php?u= " + Meteor.absoluteUrl() + "event-details/" + FlowRouter.current().params.id;
  }
})
Template.registerHelper("twitter_sharing_link_with_type",function(type){
  
  if(type =="event"){
      return "https://twitter.com/share?url=" + Meteor.absoluteUrl() + "event-details/" + FlowRouter.current().params.id;
  }
})
Template.registerHelper("linkedin_sharing_link_with_type",function(type){
     if(type =="event"){
          return "https://www.linkedin.com/shareArticle?mini=true&url=" + Meteor.absoluteUrl() + "event-details/" + FlowRouter.current().params.id;    
      }
})
Template.registerHelper('check_user_is_not_logged_in',function(){
  return localStorage.getItem("_id") == "" 
  || localStorage.getItem("_id") == undefined || localStorage.getItem("_id") == null;
})

Template.registerHelper('replace_content',function(str){
   if(str!=undefined){
    return  str.replace(/<br *\/?>/gi, '\n');   
   }  
})

Template.registerHelper('equals',function(a,b){
 // console.log("a equals b",a,b)
    return a==b;
});
Template.registerHelper('equals_with_two_arguments',function(a,b,c){
    return a==b || a == c;
});
Template.registerHelper('not_equals',function(a,b){
  //console.log("a not equals b",a,b)
    return a!=b;
});

Template.registerHelper("check_user_type" , function(){
    var user =   LoggedInUser.find({'user_id':localStorage.getItem("_id")}).fetch();
   // console.log("check_user_type",user)
   if(user[0]&&(user[0].user_type=="REFREE" ||user[0].user_type=="COACH")){
     return true
   }else{
     return false
   }
})
Template.registerHelper("check_user_type_athlete_or_retired" , function(){
    var user =   LoggedInUser.find({'user_id':localStorage.getItem("_id")}).fetch();
   // console.log("check_user_type",user)
   if(user[0]&&(user[0].user_type=="ATHLETE" || user[0].user_type=="RETIRED" )){
     return true
   }else{
     return false
   }
})
Template.registerHelper("format_user_type" , function(user_type){
  if(user_type){
    const name = user_type.toLowerCase();
    const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1)
    return nameCapitalized;
  }

})

Template.registerHelper('logged_in_user',function(){
    return localStorage.getItem("_id");
})

Template.registerHelper("trim_content",function(count,string){
  if(string.length>=count){
   return  string.substr(0,count) + "........";
  }else{
    return string;
  }
});

Template.registerHelper('return_desire_type_name',function(instituteType){
   if(instituteType=="ASSOCIATION_INSTITUTE"){
     return "Association Institute"
   }else if(instituteType=="ASSOCIATION_CLUB"){
      return "Association Club"
   }else if(instituteType=="ASSOCIATION_PROVINCIAL"){
       return "Association Provincial"
   }else{
     return "Association"
   }
})

Template.registerHelper('encoded',function(post_id){
  return Base64.encode(post_id);
})



Template.registerHelper('check_array_length',function(array){
    return array.length;
})

Template.registerHelper('check_for_length_5',function(array){
    return array.length == 5;
})

Template.registerHelper('check_for_length_4',function(array){
    return array.length == 4;
})

Template.registerHelper('check_for_length_3',function(array){
    return array.length == 3;
})
Template.registerHelper('greater_than_zero',function(array){
    return array > 0;
})


Template.registerHelper('greater_than_3',function(array){
    return parseInt(array) > 3;
})


Template.registerHelper('check_for_length_2',function(array){
    return array.length == 2;
})

Template.registerHelper('check_for_length_1',function(array){
    return array.length == 1;
})

Template.registerHelper('greater_than_10',function(array){
    return array>10;
})
Template.registerHelper('greater_than_1000',function(array){
    return array>1000;
})
Template.registerHelper('a_greater_than_b',function(a,b){
  return a>b
})

Template.registerHelper('check_for_plural',function(count,text){
  if(count > 1){
    return count + " "  +text + "s";
  }else{
    return  count + " "  +text;
  }
})

Template.registerHelper('unread_notifications',function(){
    return Session.get("unread_notifications");
})




Template.registerHelper('fetch_array_position',function(array, index){
    // console.log(array);
  if(array){
    if(array[index]){
      return array[index].source_link;      
    }
  }
   
})

Template.registerHelper('open_post_is_of_image',function(){
     return Session.get("open_post_is_of_image")
})

Template.registerHelper('last_popup_index',function(total_media, currentIndex){
     return (Session.get("totalMedia") - 1) == parseInt(Session.get("currentPopupIndex"))
})

Template.registerHelper('currentPopupIndex',function(){
     return parseInt(Session.get("currentPopupIndex"));
})


Template.registerHelper('check_media_type_video',function(array, index){
  // console.log(array);
  if(array){
    return array[index].media_type == 'video';
  }
  
})



Template.registerHelper('calculate_time_difference',function(a){
    var dt = new Date(a);
   var millis =    new Date().getTime() - dt.getTime() ;
      var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);

   var hours = (millis / (1000 * 60 * 60)).toFixed(1);

 var days = (millis / (1000 * 60 * 60 * 24)).toFixed(1);
   if(minutes<1 && seconds<10){
    return 'now';
  }else if(minutes <1 && seconds<59 ){
    return seconds + 's';
   } else if(minutes>= 1 && minutes<=59) {
    return minutes + 'm';
  }else if(minutes>=60 && hours<24){
        if(Math.floor(hours)==1 || minutes==60){
        return Math.floor(hours) + 'h';
        }else{ 
        return Math.floor(hours) + 'h';
        }
  }else if(hours>24){
    if(Math.floor(days) == 1){
    return Math.floor(days) +"d";
    }else{
      if(days>=30){
         if(days > 365){
            var years =  days/365;
            return Math.floor(years) +"Y";        
         }else if(days< 365){
          var months =  days/30;
            return Math.floor(months) +"M";        
         }
     
      }if(days >= 7){
            var weeks =  days/7;
            return Math.floor(weeks) +"W";        
      }else{
         return Math.floor(days) +"d";
      }
    }
  }
  else{    
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

});

Template.registerHelper("change_date_format" , function(timeStamp){
  console.log("timeStamp",timeStamp);

  var fullDate = new Date(timeStamp);
  var date = fullDate.getDate();
  var month = fullDate.getMonth()+1;
  var year = fullDate.getFullYear();

        if(date<10) {
            date = '0'+date
        } 
        if(month<10) {
            month = '0'+month
        } 
     return year+"-"+month+"-"+date;
})

Template.registerHelper("check_is_string_html" , function(str){
  var a = document.createElement('div');
  a.innerHTML = str;
  for (var c = a.childNodes, i = c.length; i--; ) {
    if (c[i].nodeType == 1) return true; 
  }
  return false;
})

Template.registerHelper("convert_html_into_string" , function(str){
  return  $(str).text()
})


Template.registerHelper("convert_to_desired_format",function(date){
    var d = new Date(date);
    var date = d.getDate();
    var month = d.getMonth()+1;
    var year = d.getFullYear();
    var months = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    return months[month-1]+ " " +date +", " +year;
});
Template.registerHelper("convert_to_desired_format_with_time",function(date){
    var d = new Date(date);
    var date = d.getDate();
    var month = d.getMonth()+1;
    var year = d.getFullYear();
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var months = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
     if(hours < 10){
        hours = "0"+ hours;
      }
      if(minutes <10){
        minutes = "0"+ minutes;
      }
    return months[month-1]+ " " +date +", " +year + " " + hours + ":"  + minutes; 
});
Template.registerHelper("fetch_encoded",function(keyword){
    return Utils.encodeString(keyword)
});
Template.registerHelper("increment_by_1",function(keyword){
    return keyword+1;
});
Template.registerHelper("check_if_active_url_contains",function(keyword){
    var path =Session.get("activeURL");
    // path = path.replace("/","");
		if(path && path.includes(keyword)){
			return true;
		}
});

Template.registerHelper("check_if_active_url_contains_an_array",function(array){
    var path =Session.get("activeURL");
    if(path && path.includes(keyword)){
      return true;
    }
});



Template.registerHelper("check_if_active_url_contains_multiple",function(keyword1, keyword2){
  var path =Session.get("activeURL");
  if(path && (path.includes(keyword1)  || path.includes(keyword2))){
    return true;
  }
});
Template.registerHelper("contains_unread_notifications",function(){
  return Session.get("contains_unread_notifications");
});
Template.registerHelper("check_if_group_detail_page",function(){
  var currentRoute =  FlowRouter.current().path;
  return currentRoute.includes("group-detail");
});
Template.registerHelper("make_first_character_capital",function(string){
  if(string){
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  }
});

Template.registerHelper('fetch_text_from_html',function(html){
  const text = htmlToText.fromString(html, {
    wordwrap: 10
  });
  // alert(text);
  if(text.length>=100){
  return text.substr(0,100)  + "...";
  }else{
    return text ;
  }
})

Template.registerHelper('fetch_text_from_html_and_trim',function(html){
  const text = htmlToText.fromString(html, {
    wordwrap: 5
  });
  // alert(text);
  if(text.length>=30){
  return text.substr(0,27)  + "...";
  }else{
    return text ;
  }
})
Template.registerHelper('fetch_all_graduation_years',function(){
   var data = [];
    var currentYear= new Date().getFullYear() + 30;
    var start = currentYear - 50;
    for(var i=start,j=0;i<=currentYear;j++,i++){
      data.push({year:start + j});
    }
    data.reverse();
    return data;
})
Template.registerHelper('fetch_all_graduation_years_2020',function(){
   var data = [];
    var currentYear= new Date().getFullYear() + 20;
    var start = currentYear - 80;
    for(var i=start,j=0;i<=currentYear;j++,i++){
      data.push({year:start + j});
    }
    data.reverse();
    return data;
})

Template.registerHelper('fetch_all_graduation_years_1975_2025',function(){
   var data = [];
    var currentYear= new Date().getFullYear() + 5;
    var start = currentYear - 50;
    for(var i=start,j=0;i<=currentYear;j++,i++){
      data.push({year:start + j});
    }
    data.reverse();
    return data;
})

Template.registerHelper('check_if_content_length_is_greater_than',function(string,count ){
  if(string && string.length > 100){
      return true;
  }
})
Template.registerHelper('check_if_content_length_is_greater_than_',function(string,count ){
  string = htmlToText.fromString(string);

  if(string && string.replace(/<br *\/?>/gi, '\n').length > count){
      return true;
  }
})

Template.registerHelper('trim_characters_0_100',function(string,count ){
  string = htmlToText.fromString(string);
  if(string && string.replace(/<br *\/?>/gi, '\n').length > count){
      return string.replace(/<br *\/?>/gi, '\n').substr(0,count); 
  }
})
Template.registerHelper('trim_characters_100_plus',function(string,count ){
  if(string.replace(/<br *\/?>/gi, '\n').length > count){
      return string.replace(/<br *\/?>/gi, '\n').substr(count,string.replace(/<br *\/?>/gi, '\n').length);
  }
})


Template.registerHelper('no_headline_default_text',function( ){
  return "Add Headline";
})



Template.registerHelper('to_date_not_smaller_than_current_date',function( date){
  return true;
})


Template.registerHelper('check_for_past_event',function(date){
  console.log("Registeration Date");
  console.log(date);
  return    Date.now() < date ; //+ 86400000 
})



Template.registerHelper('fetch_all_club_seasons',function(date){
   var data = [];
    var currentYear= new Date().getFullYear();
    var start = currentYear + 10;
    for(var i=currentYear,j=0;i<=start;j++,i++){
      data.push({year: (currentYear + j) + " - "  + ((currentYear + j + 1) + "").substr(2,4)});
    }
    // data.reverse();
    return data;
})


Template.registerHelper('fetch_coach_name',function(belongs_to ,school_club_details,club_details, college_details, university_details){
  if(belongs_to == Utils.getBelongsToSchoolClub()){
    return school_club_details.school_coach_name;
  }else if(belongs_to == Utils.getBelongsToCollege()){
    return college_details.coach_name;
  }else if(belongs_to == Utils.getBelongsToUniversity()){
    return university_details.coach_name;
  }
})

Template.registerHelper('fetch_player_position',function(belongs_to ,school_club_details,club_details, college_details, university_details){
  if(belongs_to == Utils.getBelongsToSchoolClub()){
    return school_club_details.school_player_position;
  }else if(belongs_to == Utils.getBelongsToCollege()){
    return college_details.player_position;
  }else if(belongs_to == Utils.getBelongsToUniversity()){
    return university_details.player_position;
  }
})

