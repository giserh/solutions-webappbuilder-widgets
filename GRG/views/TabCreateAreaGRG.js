///////////////////////////////////////////////////////////////////////////
// Copyright (c) 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

/*global define*/
define([
    'dojo',
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/dom-class',
    'dojo/on',
    'dojo/topic',
    'dojo/_base/html',
    'dojo/json',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/dijit/Message',
    'esri/IdentityManager',
    'esri/config',
    'esri/arcgis/OAuthInfo',
    'esri/arcgis/Portal',
    'esri/geometry/geometryEngine',
    'esri/layers/GraphicsLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/LabelClass',
    'esri/request',
    'esri/SpatialReference',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/geometry/Polygon',
    'esri/dijit/PopupTemplate',
    'esri/symbols/Font',
    'esri/Color',
    'esri/graphic',
    'esri/toolbars/draw',
    'esri/toolbars/edit',
    'esri/symbols/TextSymbol',
    './drawGRG',
    'dojo/text!../templates/TabCreateAreaGRG.html',
    'dijit/form/NumberSpinner'
], function (
    dojo,
    dojoDeclare,
    dojoLang,
    dojoClass,
    dojoOn,
    dojoTopic,
    html,
    JSON,
    dijitWidgetBase,    
    dijitTemplatedMixin,
    dijitWidgetsInTemplate,
    Message,
    esriId,
    esriConfig,
    OAuthInfo,
    arcgisPortal,
    geometryEngine,
    GraphicsLayer,
    FeatureLayer,
    LabelClass,
    esriRequest,
    SpatialReference,
    SimpleFillSymbol,
    SimpleLineSymbol,
    SimpleRenderer,
    Polygon,
    PopupTemplate,
    Font,
    Color,
    Graphic,
    Draw,
    Edit,
    TextSymbol,
    drawGRG,
    templateStr    
) {
    'use strict';
    return dojoDeclare([dijitWidgetBase, dijitTemplatedMixin, dijitWidgetsInTemplate], {
        templateString: templateStr,
        baseClass: 'jimu-widget-TabLine',
        GRG: null,

        constructor: function (args) {
          dojoDeclare.safeMixin(this, args);
        },

        postCreate: function () {       
          this.angle = 0;
          this.currentUnit = 'meters';
          
          // create graphics layer for grid extent and add to map
          this._graphicsLayerGRGExtent = new GraphicsLayer();
          this._extentSym = new SimpleFillSymbol(this.GRGAreaAreaFillSymbol);
          
          // create a renderer for the grg layer to override default symbology
          var gridColor = new Color("#000");
          var gridLine = new SimpleLineSymbol("solid", gridColor, 2.5);
          var gridSymbol = new SimpleFillSymbol("solid", gridLine, null);
          var gridRenderer = new SimpleRenderer(gridSymbol);

          var featureCollection = {
            "layerDefinition": {
              "geometryType": "esriGeometryPolygon",
              "objectIdField": "ObjectID",
              "fields": [{
                "name": "ObjectID",
                "alias": "ObjectID",
                "type": "esriFieldTypeOID"
                }, {
                "name": "grid",
                "alias": "grid",
                "type": "esriFieldTypeString"
              }]
            }
          };

          this.GRGArea = new FeatureLayer(featureCollection,{
            id: "GRG",
            outFields: ["*"]
          });
          this.GRGArea.setRenderer(gridRenderer);

          var json = {
            "labelExpressionInfo": {"value" : "{grid}"}
          };

          // create a text symbol to define the style of labels
          var labelClass = new LabelClass(json);
          labelClass.symbol = new TextSymbol({
            font: new Font("11", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "Helvetica"),
            color: new Color("#666633")
          });
          this.GRGArea.setLabelingInfo([labelClass]);
          
          this.map.addLayers([this.GRGArea,this._graphicsLayerGRGExtent]);          
          
          // add draw toolbar
          this.dt = new Draw(this.map);
          
          // add edit toolbar that will be used for rotating grid 
          this.editToolbar = new Edit(this.map);
                    
          this.syncEvents();
          this.initSaveToPortal();
          
          
        },
        
        syncEvents: function () {
          
          dojoTopic.subscribe('DD_WIDGET_OPEN', dojoLang.hitch(this, this.setGraphicsShown));
          dojoTopic.subscribe('DD_WIDGET_CLOSE', dojoLang.hitch(this, this.setGraphicsHidden));
          dojoTopic.subscribe('TAB_SWITCHED', dojoLang.hitch(this, this.tabSwitched));         
          
          this.own(dojoOn(
            this.createGRGButton,
            'click',
            dojoLang.hitch(this, this.createGRG)
          ));
          
          this.own(dojoOn(
            this.addGRGAreaBtn,
            'click',
            dojoLang.hitch(this, this.addGRGAreaButtonClicked)
          ));      
                    
          this.own(dojoOn(
            this.deleteGRGAreaBtn,
            'click',
            dojoLang.hitch(this, this.deleteGRGAreaButtonClicked)
          ));
          
          this.own(dojoOn(
            this.gridAngle, 
            'change',
            dojoLang.hitch(this, this.angleChange)
          ));
          
          this.own(dojoOn(
            this.cellUnits, 
            'change',
            dojoLang.hitch(this, this.cellUnitsChange)
          ));
          
          this.own(
            this.dt.on(
              'draw-complete',
              dojoLang.hitch(this, this.drawGRGAreaComplete)
          ));
          
          this.own(
            this._graphicsLayerGRGExtent.on(
              'click',
              dojoLang.hitch(this, function(evt) {
               this.editToolbar.activate(Edit.MOVE, evt.graphic); 
              })
          ));
          
          this.editToolbar.on("graphic-move-stop", dojoLang.hitch(this,function(evt){
            this.editToolbar.deactivate();
          }));          
        },
              
        angleChange: function () {          
          if (this.gridAngle.isValid() && !isNaN(this.gridAngle.value) && this._graphicsLayerGRGExtent.graphics[0]){                        
            var rotateBy = this.gridAngle.getValue() - this.angle;            
            var geom = geometryEngine.rotate(this._graphicsLayerGRGExtent.graphics[0].geometry, rotateBy*-1);
            this._graphicsLayerGRGExtent.clear();
            var graphic = new Graphic(geom, this._extentSym);
            this._graphicsLayerGRGExtent.add(graphic);            
            this.angle = this.gridAngle.getValue();
          }          
        },
        
        cellUnitsChange: function () {
          this.cellWidth.setValue(drawGRG.convertUnits(this.currentUnit,this.cellUnits.value,this.cellWidth.value));
          this.cellHeight.setValue(drawGRG.convertUnits(this.currentUnit,this.cellUnits.value,this.cellHeight.value));
          this.currentUnit = this.cellUnits.value;
        },
        
        deleteGRGAreaButtonClicked: function () {
          this._graphicsLayerGRGExtent.clear();
          
          //reset the angle
          this.angle = 0;
          this.gridAngle.setValue(0);         
          
          html.removeClass(this.addGRGAreaBtn, 'jimu-state-active');          
          html.removeClass(this.addGRGArea, 'controlGroupHidden');
          html.addClass(this.addGRGArea, 'controlGroup');
          html.removeClass(this.deleteGRGArea, 'controlGroup');
          html.addClass(this.deleteGRGArea, 'controlGroupHidden');          
        },        
        
        addGRGAreaButtonClicked: function () {
          this.GRGArea.clear();
          
          //refresh each of the feature/graphic layers to enusre labels are removed
          for(var j = 0; j < this.map.graphicsLayerIds.length; j++) {
            this.map.getLayer(this.map.graphicsLayerIds[j]).refresh();
          }
          
          this.map.disableMapNavigation();
          this.dt.activate('rectangle');
          dojoClass.toggle(this.addGRGAreaBtn, 'jimu-state-active');
          html.addClass(this.saveGRGButton, 'controlGroupHidden');
        },

        drawGRGAreaComplete: function (evt) {          
          var graphic = new Graphic(evt.geometry, this._extentSym);          
          this._graphicsLayerGRGExtent.add(graphic);
          this.map.enableMapNavigation();
          this.dt.deactivate();
          
          this.cellWidth.setValue(parseInt((geometryEngine.distance(evt.geometry.getPoint(0,0), evt.geometry.getPoint(0,1), this.cellUnits.value))/9));
          this.cellHeight.setValue(parseInt((geometryEngine.distance(evt.geometry.getPoint(0,0), evt.geometry.getPoint(0,3), this.cellUnits.value))/9));
          
                    
          dojoClass.toggle(this.addGRGArea, "controlGroupHidden");
          dojoClass.toggle(this.deleteGRGArea, "controlGroupHidden");
        },
        
        createGRG: function () {                 
          //check form inputs for validity
          if (this._graphicsLayerGRGExtent.graphics[0] && this.addGRGName.isValid() && this.cellWidth.isValid() && this.cellHeight.isValid()) {
            
            var geom = this._graphicsLayerGRGExtent.graphics[0].geometry;

            //work out width and height of AOI
            var GRGAreaWidth = geometryEngine.distance(geom.getPoint(0,0), geom.getPoint(0,1), 'meters');
            var GRGAreaHeight = geometryEngine.distance(geom.getPoint(0,0), geom.getPoint(0,3), 'meters');
            
            var cellWidth = drawGRG.convertUnits(this.cellUnits.value,"meters",this.cellWidth.value);
            var cellHeight = drawGRG.convertUnits(this.cellUnits.value,"meters",this.cellHeight.value);
   
            //work out how many cells are needed horizontally & Vertically to cover the whole canvas area
            var numCellsHorizontal = Math.ceil(GRGAreaWidth/cellWidth);
            var numCellsVertical = Math.ceil(GRGAreaHeight/cellHeight);
            
            if(drawGRG.checkGridSize(numCellsHorizontal,numCellsVertical))
            {
              
              //get center point of AOI
              var centerPoint = geom.getCentroid();              
              var features = drawGRG.createGRG(numCellsHorizontal,numCellsVertical,centerPoint,cellWidth,cellHeight,this.angle,this.labelStartPosition.value,this.labelStyle.value); 
              //apply the edits to the feature layer
              this.GRGArea.applyEdits(features, null, null);
              this.deleteGRGAreaButtonClicked();              
              html.removeClass(this.saveGRGButton, 'controlGroupHidden');
            }
          }
          else {
            // Invalid entry
            var alertMessage = new Message({
              message: '<p>The GRG creation form has missing or invalid parameters, Please ensure:</p><ul><li>The GRG Name is not blank.</li><li>A GRG area has been drawn.</li><li>The cell width and height contain valid values.</li></ul>'
            });          
          }
        },
        
        setGraphicsHidden: function () {
          if (this._graphicsLayerGRGExtent) {
            this._graphicsLayerGRGExtent.hide();
          }
        },
        
        setGraphicsShown: function () {
          if (this._graphicsLayerGRGExtent) {
            this._graphicsLayerGRGExtent.show();
          }
        },
        
        tabSwitched: function () {
          this.GRGArea.clear();
          //refresh each of the feature/graphic layers to enusre labels are removed
          for(var j = 0; j < this.map.graphicsLayerIds.length; j++) {
            this.map.getLayer(this.map.graphicsLayerIds[j]).refresh();
          }
          this.dt.deactivate();
          this.deleteGRGAreaButtonClicked();
          html.addClass(this.saveGRGButton, 'controlGroupHidden');
        },

        initSaveToPortal: function() {          
          
          esriId.registerOAuthInfos();
          
          this.own(dojoOn(this.saveGRGButton, "click", dojoLang.hitch(this, function(evt) {
          
          var featureServiceName = this.addGRGName.value;
          
          esriId.getCredential(this.appConfig.portalUrl + "/sharing", { oAuthPopupConfirmation: false }).then(dojoLang.hitch(this, function() {
              //sign in
              new arcgisPortal.Portal(this.appConfig.portalUrl).signIn().then(dojoLang.hitch(this, function(portalUser) {
               //Get the token
                var token = portalUser.credential.token;
                var orgId = portalUser.orgId;
                var userName = portalUser.username;
                
                var checkServiceNameUrl = this.appConfig.portalUrl + "sharing/rest/portals/" + orgId + "/isServiceNameAvailable";
                var createServiceUrl = this.appConfig.portalUrl + "sharing/content/users/" + userName + "/createService"; 

                this.isNameAvailable(checkServiceNameUrl, token, featureServiceName).then(dojoLang.hitch(this, function(response0) {
                  if (response0.available) {
                    //set dojoLang to busy
                    dojoTopic.publish('SHOW_BUSY');
                    //create the service
                    this.createFeatureService(createServiceUrl, token, 
                      this.getFeatureServiceParams(featureServiceName)).then(dojoLang.hitch(this, function(response1) {
                        if (response1.success) {
                          var addToDefinitionUrl = response1.serviceurl.replace(new RegExp('rest', 'g'), "rest/admin") + "/addToDefinition";
                          
                          
                          this.addDefinitionToService(addToDefinitionUrl, token, 
                            this.getLayerParams(featureServiceName)).then(dojoLang.hitch(this, function(response2) {

                              if (response2.success) {
                                //Push features to new layer
                                 var newFeatureLayer = new FeatureLayer(response1.serviceurl + "/0?token=" + token, {
                                   outFields: ["*"]                                  
                                 });
                                 this.map.addLayer(newFeatureLayer);
                                
                                newFeatureLayer.applyEdits(this.GRGArea.graphics,null,null).then(dojoLang.hitch(this, function(){
                                  this.tabSwitched();                                
                                })).otherwise(dojoLang.hitch(this,function(){this.tabSwitched();}));                                
                              }

                            }), function(err2) {
                              new Message({
                                message: "Add to definition: " + err2.message
                              });                              
                            });
                        } else {
                          new Message({
                            message: "Unable to create " + featureServiceName
                          });
                        }
                      }), function(err1) {
                        new Message({
                          message: "Create Service: " + err1.message
                        });
                      });
                  } else {
                     new Message({
                      message: "You already have a feature service named " + featureServiceName + ". Please choose another name."
                    });                    
                  }
                }), function(err0) {
                  new Message({
                    message: "Check Service: " + err0.message
                  });
                });

              }))
            }));
        })));
      },

      isNameAvailable: function(serviceName, token, featureServiceName) {
        //Check for the layer name
        var def = esriRequest({
          url: serviceName,
          content: {
            name: featureServiceName,
            type: "Feature Service",
            token: token,
            f: "json"
          },
          handleAs: "json",
          callbackParamName: "callback"
        },{usePost: true});
        return def;
      },

      createFeatureService: function(serviceUrl, token, createParams) {
        //create the service
        var def = esriRequest({
          url: serviceUrl,
          content: {
            f: "json",
            token: token,
            typeKeywords: "ArcGIS Server,Data,Feature Access,Feature Service,Service,Hosted Service",
            createParameters: JSON.stringify(createParams),
            outputType: "featureService"
          },
          handleAs: "json",
          callbackParamName: "callback"
        },{usePost: true});
        return def;
      },

      addDefinitionToService: function(serviceUrl, token, defParams) {
        var def = esriRequest({
          url: serviceUrl,
          content: {
            token: token,
            addToDefinition: JSON.stringify(defParams),
            f: "json"                            
          },
          handleAs: "json",
          callbackParamName: "callback"                          
        },{usePost: true});
        return def;
      },

      getFeatureServiceParams: function(featureServiceName) {
        return {
         "name" : featureServiceName,
         "serviceDescription" : "",
         "hasStaticData" : false,
         "maxRecordCount" : 1000,
         "supportedQueryFormats" : "JSON",
         "capabilities" : "Create,Delete,Query,Update,Editing",
         "description" : "",
         "copyrightText" : "",
         "spatialReference" : {
            "wkid" : 102100
            },
         "initialExtent" : {
            "xmin" : -20037507.0671618,
            "ymin" : -30240971.9583862,
            "xmax" : 20037507.0671618,
            "ymax" : 18398924.324645,
            "spatialReference" : {
               "wkid" : 102100,
               "latestWkid" : 3857
               }
            },
         "allowGeometryUpdates" : true,
         "units" : "esriMeters",
         "xssPreventionInfo" : {
            "xssPreventionEnabled" : true,
            "xssPreventionRule" : "InputOnly",
            "xssInputRule" : "rejectInvalid"
          }
        }
      },

      getLayerParams: function(layerName) {          
        return {
          "layers": [
            {
              "adminLayerInfo": {
                "geometryField": {
                  "name": "Shape"
                },
                "xssTrustedFields": ""
              },
              "id": 0,
              "name": layerName,
              "type": "Feature Layer",
              "displayField": "",
              "description": "",
              "copyrightText": "",
              "defaultVisibility": true,
              "ownershipBasedAccessControlForFeatures" : {
                "allowOthersToQuery" : false, 
                "allowOthersToDelete" : false, 
                "allowOthersToUpdate" : false
              },              
              "relationships": [],
              "isDataVersioned" : false, 
              "supportsCalculate" : true, 
              "supportsAttachmentsByUploadId" : true, 
              "supportsRollbackOnFailureParameter" : true, 
              "supportsStatistics" : true, 
              "supportsAdvancedQueries" : true, 
              "supportsValidateSql" : true, 
              "supportsCoordinatesQuantization" : true, 
              "supportsApplyEditsWithGlobalIds" : true,
              "advancedQueryCapabilities" : {
                "supportsPagination" : true, 
                "supportsQueryWithDistance" : true, 
                "supportsReturningQueryExtent" : true, 
                "supportsStatistics" : true, 
                "supportsOrderBy" : true, 
                "supportsDistinct" : true, 
                "supportsQueryWithResultType" : true, 
                "supportsSqlExpression" : true, 
                "supportsReturningGeometryCentroid" : true
              },          
              "useStandardizedQueries" : false,      
              "geometryType": "esriGeometryPolygon",
              "minScale" : 0, 
              "maxScale" : 0,
              "extent": {
                "xmin" : -20037507.0671618,
                "ymin" : -30240971.9583862,
                "xmax" : 20037507.0671618,
                "ymax" : 18398924.324645,
                "spatialReference": {
                  "wkid": 102100,
                  "latestWkid": 3857
                }
              },
              "drawingInfo": {
                "renderer": {
                 "type": "simple",
                 "symbol": {
                  "color": null,
                  "outline": {
                   "color": [
                    26,
                    26,
                    26,
                    255
                   ],
                   "width": 1.5,
                   "type": "esriSLS",
                   "style": "esriSLSSolid"
                  },
                  "type": "esriSFS",
                  "style": "esriSFSSolid"
                 }
                },
                "transparency": 0,
                "labelingInfo": [
                   {
                    "labelExpression": "[grid]",
                    "labelExpressionInfo": {"value": "{grid}"},
                    "format": null,
                    "fieldInfos": null,
                    "useCodedValues": false,
                    "maxScale": 0,
                    "minScale": 0,
                    "where": null,
                    "sizeInfo": null,
                    "labelPlacement": "esriServerPolygonPlacementAlwaysHorizontal",
                    "symbol": {
                     "color": [
                      51,
                      51,
                      51,
                      255
                     ],
                     "type": "esriTS",
                     "backgroundColor": null,
                     "borderLineColor": null,
                     "haloSize": 0,
                     "haloColor": null,
                     "horizontalAlignment": "center",
                     "rightToLeft": false,
                     "angle": 0,
                     "xoffset": 0,
                     "yoffset": 0,
                     "text": "",
                     "rotated": false,
                     "kerning": true,
                     "font": {
                      "size": 9.75,
                      "style": "normal",
                      "decoration": "none",
                      "weight": "bold",
                      "family": "Arial"
                     }
                    }
                   }
                ]
              },
              "allowGeometryUpdates": true,
              "hasAttachments": false,
              "htmlPopupType": "esriServerHTMLPopupTypeNone",
              "hasM": false,
              "hasZ": false,
              "objectIdField": "OBJECTID",
              "globalIdField": "",
              "typeIdField": "",
              "fields": [
                {
                  "name": "OBJECTID",
                  "type": "esriFieldTypeOID",
                  "actualType": "int",
                  "alias": "OBJECTID",
                  "sqlType": "sqlTypeOther",
                  "nullable": false,
                  "editable": false,
                  "domain": null,
                  "defaultValue": null
                },
                {
                  "name": "GRID",
                  "type": "esriFieldTypeString",
                  "alias": "GRID",
                  "actualType": "nvarchar",
                  "nullable": true,
                  "editable": true,
                  "domain": null,
                  "defaultValue": null,
                  "sqlType": "sqlTypeNVarchar",
                  "length": 256
                }
              ],
              "indexes": [],
              "types": [],
              "templates": [
                {
                  "name": "New Feature",
                  "description": "",
                  "drawingTool": "esriFeatureEditToolPolygon",
                  "prototype": {
                    "attributes": {
                      "GRID": null
                    }
                  }
                }
              ],
              "supportedQueryFormats": "JSON",
              "hasStaticData": false,
              "maxRecordCount": 10000,
              "standardMaxRecordCount" : 4000,               
              "tileMaxRecordCount" : 4000, 
              "maxRecordCountFactor" : 1,   
              "exceedsLimitFactor" : 1,           
              "capabilities": "Query,Editing,Create,Update,Delete"
            }
          ]
        }        
      }       
  });
});