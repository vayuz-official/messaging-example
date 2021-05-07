import {
	PopupUtils
} from './../../../utils/PopupUtils'
import {
	Utils
} from './../../../utils/utils.js';
import { ImageUtilsNetwork } from '../../../network/image_utils/ImageUtilsNetwork.js';
import './image_uploader.html';
Template.image_uploader.events({
	"change .upload_file_input":async function(event){
		event.preventDefault();
		    if (event.currentTarget.files && event.currentTarget.files[0]) {
	     	var file = event.currentTarget.files[0];
			 var type = event.currentTarget.files[0].type;
	         const name = event.target.files[0].name;
	          const lastDot = name.lastIndexOf('.');
	          const fileName = name.substring(0, lastDot);
	          const ext = name.substring(lastDot + 1);
	          if(Utils.getUploadedDocumentType().includes(ext)){
	          	var fileObj = event.currentTarget.files[0];
				new ImageUtilsNetwork().prepareFormObjAndReturnUrl(fileObj,"#" + Template.instance().data.image_id);    
	          }else{
	            PopupUtils.showErrorPopupWithMessage(fileName + "  rejected becuase of unsupported extension");
	      }
      }
	},
	'click .cross-image':function(event){
		event.preventDefault();
		$("#cross_icon_"+ Template.instance().data.image_id).addClass("display_hidden");
		$("#" + Template.instance().data.image_id).attr("src","/images/resources/admin2.jpg");
	}
})