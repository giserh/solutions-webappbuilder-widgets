///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(['dojo/_base/declare', 
        'jimu/BaseWidget', 
        'esri/toolbars/draw', 
        'esri/symbols/SimpleMarkerSymbol', 
        'esri/graphic', 
        'esri/Color', 
        'dojo/dom', 
        'dojo/on',
        'esri/geometry/webMercatorUtils', 
        'esri/layers/FeatureLayer', 
        'dojo/_base/lang', 
        'dojo/_base/array', 
        'dojox/data/CsvStore', 
        'dojox/encoding/base64',
        'esri/geometry/Point', 
        'esri/geometry/Multipoint', 
        'esri/InfoTemplate', 
        'esri/tasks/QueryTask', 
        'esri/tasks/query',
        './MapCSV',
        'jimu/dijit/Message',
        'esri/SpatialReference'
    ],

    function(declare, BaseWidget, Draw, SimpleMarkerSymbol, 
        Graphic, Color, dom, on, webMercatorUtils, 
        FeatureLayer, lang, arrayUtils, CsvStore, base64,
        Point, Multipoint, InfoTemplate, QueryTask, 
        Query, MapCSV, Message, SpatialReference) {
        //To create a widget, you need to derive from BaseWidget.

       var _CSVObj;

        return declare([BaseWidget], {
    
            baseClass: 'solutions-widget-geolookup',
            name: 'GeoLookup',

            postCreate: function() {
                this.inherited(arguments);
                _CSVObj = new MapCSV();
                _CSVObj.setParams(this.config,this.map);
            },

            startup: function() {
                this.inherited(arguments);

                var c = dom.byId(this.id);
                on(c, 'dragover', function(event) {
                    event.preventDefault();
                });

                on(c, 'dragenter', function(event) {
                    event.preventDefault();
                });

                on(c, 'drop', this._handleCSVDrop);
            },

            _handleCSVDrop: function(event) {
                event.preventDefault();
                var dataTransfer = event.dataTransfer;
                var files = dataTransfer.files;
                   if (files.length >0) {
                        var file = files[0];
                        if (file.name.indexOf('.csv') !== -1){
                            if (file) {
                                _CSVObj.handleCSV(file);
                            }else{
                                new Message({
                                    message: 'File could not be processed.'
                                 });
                            }
                       } else{
                             new Message({
                                message: 'Only comma delimited files (.csv) files are supported at this time.'
                             });
                       }    
                    }
            },

            onOpen: function() {
                //console.log('onOpen');
            },

            onClose: function() {
                //console.log('onClose');
            },

            onMinimize: function() {
                //console.log('onMinimize');
            },

            onMaximize: function() {
                //console.log('onMaximize');
            },

            onSignIn: function(credential) {
                /* jshint unused:false*/
                //console.log('onSignIn');
                console.log(credential);
            },

            onSignOut: function() {
                //console.log('onSignOut');
            }
        });
    });