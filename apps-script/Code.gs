// Google Apps Script — receives photos from the photobooth and saves them to Drive.
// Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.

const FOLDER_ID = '1AHjp3AM5rrcI4HgSkBTAZ0tYLzuV1ao8';

// true = each guest gets their own subfolder (named after them) inside FOLDER_ID.
const SUBFOLDER_PER_GUEST = true;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = clean_(data.name) || 'Guest';
    const filename = clean_(data.filename) || name + ' - ' + new Date().toISOString() + '.jpg';

    const match = /^data:image\/(jpeg|png);base64,(.+)$/.exec(data.image || '');
    if (!match) throw new Error('Invalid image');
    const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), 'image/' + match[1], filename);

    let folder = DriveApp.getFolderById(FOLDER_ID);
    if (SUBFOLDER_PER_GUEST) {
      const found = folder.getFoldersByName(name);
      folder = found.hasNext() ? found.next() : folder.createFolder(name);
    }
    const file = folder.createFile(blob);
    file.setDescription('Photobooth — ' + name);

    return json_({ ok: true, id: file.getId() });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// ?action=list → every photo for the Photo Binder page.
// Without it, opening the /exec URL just confirms the deployment works.
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'list') {
    try {
      return json_({ ok: true, photos: listPhotos_() });
    } catch (err) {
      return json_({ ok: false, error: String(err.message || err) });
    }
  }
  return json_({ ok: true, message: "Belly's Bar photobooth is ready" });
}

function listPhotos_() {
  const root = DriveApp.getFolderById(FOLDER_ID);
  // The binder loads images straight from Drive, so the folder must be viewable by link.
  if (root.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
    root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  const photos = [];
  collect_(root, '', photos);
  photos.sort(function (a, b) { return b.time - a.time; });
  return photos;
}

function collect_(folder, guest, out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType().indexOf('image/') !== 0) continue;
    out.push({
      id: f.getId(),
      name: f.getName(),
      guest: guest || f.getName().split(' - ')[0],
      time: f.getDateCreated().getTime(),
    });
  }
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    collect_(sub, sub.getName(), out);
  }
}

function clean_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
