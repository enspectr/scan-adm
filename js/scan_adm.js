'use strict';

(() => {

const Connection = __ble_mx_api.ConnectionExt;

const str2Uint8Array = __ble_mx_api.str2Uint8Array;
const DataView2str   = __ble_mx_api.DataView2str;
const str_csum       = __ble_mx_api.str_csum;
const CSUM_LEN       = __ble_mx_api.CSUM_LEN;
const COMPRESS_TAG   = __ble_mx_api.COMPRESS_TAG;
const compress       = __ble_mx_api.compress;
const decompress     = __ble_mx_api.decompress;

const bt_btn = document.getElementById('bt-btn');
const cmd_arg = [
	document.getElementById('cmd-arg1'),
	document.getElementById('cmd-arg2'),
	document.getElementById('cmd-arg3')
]
const txt_res   = document.getElementById('txt-res');
const cmd_empty = document.getElementById('opt-select-cmd-empty');
const log_empty = document.getElementById('opt-select-cmd-empty');
const ncmd_args = cmd_arg.length;

let bt_conn = null;

function initPage()
{
	if (!navigator.bluetooth) {
		document.body.innerHTML = '<div class="alert-page">The Bluetooth is not supported in this browser. Please try another one.</div>';
		return;
	}
	cmd_empty.textContent = '--command--';
	bt_btn.textContent = 'Connect';
	bt_btn.onclick = onBtn;
	bt_conn = new Connection(rx_cb, true);
}

function onDisconnection(device)
{
	bt_btn.disabled = true;
	for (let i = 0; i < ncmd_args; ++i)
		cmd_arg[i].disabled = true;
	txt_res.disabled = true;
	connectTo(device);
}

function send_cmd()
{
}

function on_rx(str)
{
}

function do_receive(data)
{
	let str = DataView2str(data);
	console.debug('rx:', str);
	if (str.slice(-CSUM_LEN) != str_csum(str, str.length - CSUM_LEN)) {
		console.error('bad csum:', str);
		return;
	}
	on_rx(str.slice(0, -CSUM_LEN));
}

function rx_cb(data, is_binary=false)
{
	const len = data.byteLength;
	if (data.getUint8(len - 1) != COMPRESS_TAG) {
		do_receive(data);
		return;
	}
	decompress(new DataView(data.buffer, 0, len - 1)).then(d => {
		console.log("unzip:", len - 1, '->', d.byteLength);
		do_receive(d);
	})
	.catch((err) => {console.error('failed to decompress', err);});
}

function onBTConnected(device)
{
	bt_btn.textContent = 'Send';
}

function connectTo(device)
{
	bt_conn.connect(device, onBTConnected, onDisconnection);
}

function doConnect(devname)
{
	console.log('doConnect', devname);
	bt_btn.disabled = true;
	let filters = [{services: [Connection.bt_svc_id]}];
	if (devname) {
		filters.push({name: devname});
	}
	return navigator.bluetooth.requestDevice({
		filters: filters,
	}).
	then((device) => {
		console.log(device.name, 'selected');
		connectTo(device);
	})
	.catch((err) => {
		console.error('Failed to discover BT devices');
		bt_btn.textContent = 'Connect';
		bt_btn.disabled = false;
	});
}

function txString(str)
{
	str += str_csum(str);
	console.debug('tx:', str);
	bt_conn.write(str2Uint8Array(str));
}

function onBtn(event)
{
	if (bt_conn.is_connected())
		send_cmd();
	else
		doConnect();
}

initPage();

})();

