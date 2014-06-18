import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamReader;

import java.net.HttpURLConnection;
import java.net.URL;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpEntity;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.mime.HttpMultipartMode;
import org.apache.http.entity.mime.MultipartEntity;
import org.apache.http.entity.mime.content.ContentBody;
import org.apache.http.entity.mime.content.FileBody;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.util.EntityUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Helper class for calling ZAPI */
public class ZAPI {
  
  /** Status IDs */
  private static final int ZAPI_STATUS_PASS = 1;
  private static final int ZAPI_STATUS_FAIL = 2;
  private static final int ZAPI_STATUS_WIP = 3;
  private static final int ZAPI_STATUS_BLOCKED = 4;
  
  /** URLS */
  private static final String BASE_URL= "http://jira_server:port";
  private static final String ZAPI_URL = BASE_URL + "/rest/zapi/latest/";
  private static final String JIRA_API_URL = BASE_URL + "/rest/api/latest/";
  
  /** JIRA credentials */
  private static final String CREDENTIALS = "username:password";
  
  /**
   * Returns the ID for the specified Version in the specified Project
   * 
   * @param versionName
   * @param projectId
   */
   public static String getVersionID(final String versionName, final String projectId) {
     try {
       //Get list of versions on the specified project
       final JSONObject obj = (JSONObject) get(ZAPIURL + "util/versionBoard-list?projectId=" + projectId);
       if(null != obj) {
          final JSONArray versionOptions = (JSONArray) obj.get("versionOptions");
          //Iterate over versions
          for(int i = 0; i < versionOptions.length(); i++) {
            final JSONObject obj2 = versionOptions.getJSONObject(i);
            //If label matches specifed version name
            if(obj2.getString("label").equals(versionName)) {
             //Return the ID for this version
             return obj2.getString("value");
           }
          }
       }
     } catch (final JSONException e) {
       e.printStackTrace();
     }
     }
     return null;
   }
   
   
   /**
    * Send GET request to the specified URL
    * @param url
    */
    private static Object get(final String url)
    {
      try {
        final HttpURLConnection httpCon = (HttpURLConnection) new URL(url).openConnection();
        
        httpCon.setDoOutput(true);
        httpCon.setRequestMethod("GET");
        
        final String encoding = new Base64().encodeToString(CREDENTIALS.getBytes());
        httpCon.setRequestProperty("Authorization", "Basic " + encoding);
        
        httpCon.setRequestProperty("Content-type", "application/json");
        
        final BufferedReader rd = new BufferedReader(new InputStreamReader(httpCon.getInputStream()));
        final StringBuffer result = new StringBuffer();
        String line = "";
        while(null != (line = rd.readLine())) {
          result.append(line);
        }
        
        final String resultString = result.toString();
        
        if(resultString.startsWith("{")) {
          return new JSONObject(resultString);
        } else if (resultString.startsWith("[")) {
          return new JSONArray(resultString);
        }
      } catch (final IOException e) {
        e.printStackTrace();
      } catch (final JSONException e) {
        e.printStackTrace();
      }
      
      return null;
    }
   
}

