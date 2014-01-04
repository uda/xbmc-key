/**
 * XBMC applet for cinnamon
 *
 * Grab the keyboard media keys to control XBMC running on a remote machine
 *
 * - Click the applet to grab the keyboard media keys
 * - Click the applet to release the keyboard media keys
 *
 * Author
 *  Yehuda Deutsch <yeh@uda.co.il>
 *
 * Based on Groove Key from
 *  Rodolphe Marques <marques.rodolphe@gmail.com>
 */

const Lang = imports.lang;
const Applet = imports.ui.applet;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;
const DBus = imports.dbus;
const Soup = imports.gi.Soup;
const Settings = imports.ui.settings;

const Commands = {
  "playPause": '{"jsonrpc":"2.0","method":"Player.PlayPause","id":1,"params":{"playerid":1}}',
  "stop": '{"jsonrpc":"2.0","method":"Player.Stop","id":1,"params":{"playerid":1}}',
  "next": '{"jsonrpc":"2.0","method":"Player.GoTo","id":1,"params":{"playerid":1,"to":"next"}}',
  "previous": '{"jsonrpc":"2.0","method":"Player.GoTo","id":1,"params":{"playerid":1,"to":"previous"}}'
};

const MediaKeysIface = {
  name: 'org.gnome.SettingsDaemon.MediaKeys',
  properties: [],
  methods: [
    {name: 'GrabMediaPlayerKeys', inSignature: 'su', outSignature: ''},
    {name: 'ReleaseMediaPlayerKeys', inSignature: 's', outSignature: ''}
  ],
  signals: [
    {name: 'MediaPlayerKeyPressed', inSignature: '', outSignature: 'ss'}
  ]
};

let MediaKeys = DBus.makeProxyClass(MediaKeysIface);

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.icon_path = metadata.path + '/icon.png';
    this.icon_alt_path = metadata.path + '/icon_alt.png';
    this._prefs = {
      "host": "localhost",
      "port": "8080",
      "path": "jsonrpc"
    };
    this.settings = new Settings.AppletSettings(this._prefs, metadata['uuid'], instance_id);
    this.settings.bindProperty(Settings.BindingDirection.IN, "host", "host", this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "port", "port", this.on_settings_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "path", "path", this.on_settings_changed, null);
    this.on_settings_changed();

    this.capture = 0;
    this.session = new Soup.SessionAsync();
    this.mediaKeysProxy = new MediaKeys(DBus.session, 'org.gnome.SettingsDaemon', '/org/gnome/SettingsDaemon/MediaKeys');
    this.mediaKeysProxy.connect('MediaPlayerKeyPressed', Lang.bind(this, this._onMediaPlayerKeyPressed));

    try {
      this.set_applet_icon_path(this.icon_path);
      this.set_applet_tooltip(_("Click here to capture media keys"));
    }
    catch(e) {
      global.logError(e);
    }
  },

  on_applet_clicked: function(event) {
    if(this.capture == 0) {
      this.set_applet_icon_path(this.icon_alt_path);
      this.set_applet_tooltip(_("Click here to release media keys"));
      this.capture = 1
      this.mediaKeysProxy.GrabMediaPlayerKeysRemote('xbmckey', 0);
    }
    else if(this.capture == 1) {
      this.set_applet_icon_path(this.icon_path);
      this.set_applet_tooltip(_("Click here to capture media keys"));
      this.capture = 0;
      this.mediaKeysProxy.ReleaseMediaPlayerKeysRemote('xbmckey');
    }
  },

  _onMediaPlayerKeyPressed: function(object, app_name, key) {
    if (app_name != 'xbmckey') {
      return;
    }
    switch(key) {
      case 'Play':
      case 'Pause':
        this._api_request('playPause');
        break;
      case 'Stop':
        this._api_request('stop');
        break;
      case 'Previous':
        this._api_request('previous');
        break;
      case 'Next':
        this._api_request('next');
        break;
      default:
        break;
    }
  },

  _api_request: function(command) {
    if (!command in Commands) {
      return;
    }
    url = this.api_url + "?request=" + encodeURIComponent(Commands[command]);
    let message = Soup.Message.new('GET', url);
    let session = this.session;
    session.queue_message(message, function(session, message) {
    });
  },

  on_settings_changed: function() {
    this.api_url = 'http://' + this._prefs.host + (this._prefs.port != 80 ? ':' + this._prefs.port : '') + '/' + this._prefs.path;
    global.log(this.api_url);
  },

  on_applet_removed_from_panel: function() {
    this.settings.finalize();
  }

};

function main(metadata, orientation, panel_height, instance_id) {
  let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}
