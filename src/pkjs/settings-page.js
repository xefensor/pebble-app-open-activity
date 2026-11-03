'use strict';

function choices(values, selected) {
  return values.map(function (value) {
    return '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' +
      value.charAt(0).toUpperCase() + value.slice(1) + '</option>';
  }).join('');
}
module.exports = function (settings, invalid) {
  var up = settings.holdOverrides.up || 'default';
  var down = settings.holdOverrides.down || 'default';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Activity</title>' +
    '<style>*{box-sizing:border-box}body{font:17px system-ui,sans-serif;background:#f5f5f1;color:#171717;margin:0}' +
    'main{max-width:36rem;margin:auto;padding:24px}h1{font-size:28px;margin:0 0 16px}' +
    'p{line-height:1.5}label{display:block;margin:24px 0 8px;font-weight:650}' +
    'select,button{font:inherit;border:1px solid #999;border-radius:8px;padding:12px;width:100%;background:white}' +
    'button{margin-top:24px;background:#171717;color:white;border:0;font-weight:650}' +
    '.cancel{background:transparent;color:#333;margin-top:8px}.notice{padding:12px;background:#fff2d4}</style>' +
    '</head><body><main><h1>Open Activity</h1>' +
    '<p>Assign <strong>Open Activity</strong> to your buttons in Pebble’s Quick Launch settings. ' +
    'Choose which Dynamic activity each shortcut opens here.</p>' +
    (invalid ? '<p class="notice">Saved settings could not be read. Save these choices to repair them.</p>' : '') +
    '<label for="up">Hold Up</label><select id="up">' + choices(['default', 'primary', 'secondary'], up) + '</select>' +
    '<label for="down">Hold Down</label><select id="down">' + choices(['default', 'primary', 'secondary'], down) + '</select>' +
    '<label for="role">Default activity</label><select id="role">' + choices(['primary', 'secondary'], settings.defaultRole) + '</select>' +
    '<p>Other hold shortcuts use Default. A missing activity returns to the watchface. ' +
    'This opens Dynamic’s recent selection, including briefly after changing watchfaces.</p>' +
    '<p>Use one connected watch and allow Open Activity to launch apps in the Pebble app.</p>' +
    '<button id="save">Save settings</button><button id="cancel" class="cancel">Cancel</button>' +
    '<script>document.getElementById("save").onclick=function(){var value={version:1,' +
    'defaultRole:document.getElementById("role").value,holdOverrides:{up:document.getElementById("up").value,' +
    'down:document.getElementById("down").value}};location.href="pebblejs://close#"+encodeURIComponent(JSON.stringify(value));};' +
    'document.getElementById("cancel").onclick=function(){location.href="pebblejs://close#";};</script></main></body></html>';
};
