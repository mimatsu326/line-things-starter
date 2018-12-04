// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID         = 'f1b21d6b-a18c-439d-8b16-de27e6fc8711'; // LED, Button
// User service characteristics
const LED_CHARACTERISTIC_UUID   = 'E9062E71-9E62-4BC6-B0D3-35CDCD9B027B';
const BTN_CHARACTERISTIC_UUID   = '62FBD229-6EDD-4D1A-B554-5C4E1BB29169';

// PSDI Service UUID: Fixed value for Developer Trial
const PSDI_SERVICE_UUID         = 'E625601E-9E55-4597-A598-76018A0D293D'; // Device ID
const PSDI_CHARACTERISTIC_UUID  = '26E2B12B-85F0-4F3F-9FDD-91D114270E6E';

// UI settings
let ledState = false; // true: LED on, false: LED off
let clickCount = 0;

var features = [];
var mapLayer ;
var markerLayer ;
var markerStyleA;
var markerFeatureA;
var marker;
var view;

// -------------- //
// On window load //
// -------------- //

window.onload = () => {
    initializeApp();
};

// ----------------- //
// Handler functions //
// ----------------- //

function handlerToggleLed() {
    ledState = !ledState;

    uiToggleLedButton(ledState);
    liffToggleDeviceLedState(ledState);
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleLedButton(state) {
    const el = document.getElementById("btn-led-toggle");
    el.innerText = state ? "Switch LED OFF" : "Switch LED ON";

    if (state) {
      el.classList.add("led-on");
    } else {
      el.classList.remove("led-on");
    }
}

function uiCountPressButton() {
    clickCount++;

    //const el = document.getElementById("click-count");
    //el.innerText = clickCount;
}

// function uiToggleStateButton(pressed) {
//     const el = document.getElementById("btn-state");

//     if (pressed) {
//         el.classList.add("pressed");
//         el.innerText = "Pressed";
//     } else {
//         el.classList.remove("pressed");
//         el.innerText = "Released";
//     }
// }

function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    elStatus.classList.remove("error");

    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
        alert("aaa");
        map_view();
        } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
        elControls.classList.add("hidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");

    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    uiToggleLoadingAnimation(showLoadingAnimation);

    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;

    // Hide controls
    elControls.classList.add("hidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    liff.init(() => initializeLiff(), error => uiStatusError(makeErrorMsg(error), false));
}

function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });;
}

function liffRequestDevice() {
    liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffConnectToDevice(device) {
    device.gatt.connect().then(() => {
        //document.getElementById("device-name").innerText = device.name;
        //document.getElementById("device-id").innerText = device.id;

        // Show status connected
        uiToggleDeviceConnected(true);

        // Get service
        device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });
        device.gatt.getPrimaryService(PSDI_SERVICE_UUID).then(service => {
            liffGetPSDIService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });

        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);

            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);

            // Reset LED state
            ledState = false;
            // Reset UI elements
            uiToggleLedButton(false);
            uiToggleStateButton(false);

            // Try to reconnect
            initializeLiff();
        };

        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetUserService(service) {
    // Button pressed state
    service.getCharacteristic(BTN_CHARACTERISTIC_UUID).then(characteristic => {
        liffGetButtonStateCharacteristic(characteristic);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });

    // Toggle LED
    service.getCharacteristic(LED_CHARACTERISTIC_UUID).then(characteristic => {
        window.ledCharacteristic = characteristic;

        // Switch off by default
        liffToggleDeviceLedState(false);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetPSDIService(service) {
    // Get PSDI value
    service.getCharacteristic(PSDI_CHARACTERISTIC_UUID).then(characteristic => {
        return characteristic.readValue();
    }).then(value => {
        // Byte array to hex string
        const psdi = new Uint8Array(value.buffer)
            .reduce((output, byte) => output + ("0" + byte.toString(16)).slice(-2), "");
        //document.getElementById("device-psdi").innerText = psdi;
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetButtonStateCharacteristic(characteristic) {
    // Add notification hook for button state
    // (Get notified when button state changes)
    characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
            const val = (new Uint8Array(e.target.value.buffer));           
            const el = document.getElementById("click-count");
            var lat_l = ( (val[3] << 24) + (val [2] << 16) + (val [1] << 8) + val [0] )/1000000;
            var lng_l = ( (val[7] << 24) + (val [6] << 16) + (val [5] << 8) + val [4] )/1000000;
            var tm = (val[8]+9)+":"+val[9]+":"+val[10];
            var dist = (val[11] << 8) + val[12];
            var dir =  (val[13] << 8) + val[14];
            el.innerText = tm + ";" + lat_l + "," + lng_l + "," + dist + "," + dir;

        });
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffToggleDeviceLedState(state) {
    // on: 0x01
    // off: 0x00
    window.ledCharacteristic.writeValue(
        state ? new Uint8Array([0x01]) : new Uint8Array([0x00])
    ).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}


/////////////////////////////////////////////////////////////////////////////////////////////////
function map_view() {
    //var features = [];
    
    //var mark_pos = {
    //"mk1": {lat:35.515, lon:133.27 ,color:"red"},
    //"mk2": {lat:35.51442, lon:133.2768567 ,color:"red"},
    //"mk3": {lat:35.50831167, lon:133.2687583 ,color:"blue"},
    //"mk4": {lat:35.50908167, lon:133.2804667 ,color:"yellow"},
    //};
    
    //表示用のview
    view = new ol.View({
        projection: "EPSG:3857",
        maxZoom: 18,
        minZoom: 0
    });
    
    //地図用のレイヤ
    mapLayer = new ol.layer.Tile({
        name : "MapLayer",
        source: new ol.source.OSM() //openstreet map
    });
    
    //mapを設定
    map = new ol.Map({
        target: document.getElementById('map'),
        layers: [mapLayer],
        view: view,
        renderer: ['canvas', 'dom'],
        controls: ol.control.defaults(),
        interactions: ol.interaction.defaults()
    });
    
    //中心座標
    var default_lon = 133.265782;
    var default_lat = 35.512483;
    
    //センターの初期設定
    view.setCenter(ol.proj.transform([default_lon, default_lat], "EPSG:4326", "EPSG:3857"));
    
    //ズームレベルの初期設定
    view.setZoom(14);
    
    //スケールラインの追加
    map.addControl(new ol.control.ScaleLine());
    
    //マーカー用レイヤの作成
    markerLayer = new ol.layer.Vector({
        name : "MarkerLayer",
        source : new ol.source.Vector()
    });
    
    //マーカー用レイヤをマップに追加
    map.addLayer(markerLayer);
    
    //マーカーの追加
    //for (var key in mark_pos) {
    //    marker = makeFeature(ol.proj.transform([mark_pos[key].lon, mark_pos[key].lat], "EPSG:4326", "EPSG:3857"),key,mark_pos[key].color);
    //    features.push(marker);
    //}
    //markerLayer.getSource().addFeatures(features);
    
    markerStyleA = new ol.style.Style({
        image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ {
            anchor: [0.5, 0.5],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            opacity: 1,
            scale:0.5,
            rotation:300/180*3.141592,
            src: 'http://jsrun.it/assets/s/p/v/r/spvrT.png'
        }),
        
        text : new ol.style.Text({
            font: "bold 10px sans-serif",
            text : "100d 2kt",
            textAlign: "left",
            textBaseline: "top",
            offsetX: 10,
            offsetY: 10
            
        })     
    });
    
    
    markerFeatureA = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.transform([default_lon, default_lat], "EPSG:4326", "EPSG:3857"))
    });
    markerFeatureA.setStyle(markerStyleA);
    features.push(markerFeatureA);
    markerLayer.getSource().addFeatures(features);
    
}
///////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////    
//マーカーのfeatureを作成
function makeFeature(point,mk_name,clr) {
    
    //円を作成
    feature = new ol.Feature({
        geometry : new ol.geom.Point([point[0], point[1] ]),
        name : mk_name
    });
    var style = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 4,
            fill: new ol.style.Fill({
                color: clr
            })
        }),
        
        text : new ol.style.Text({
            font: "bold 16px sans-serif",
            text : "",
            textAlign: "left",
            textBaseline: "top",
            offsetX: 5,
            offsetY: 5
            
        })                
        
    });
    
    feature.setStyle(style);
    
    return feature;
}
/////////////////////////////////////////////////////////////////////////////
