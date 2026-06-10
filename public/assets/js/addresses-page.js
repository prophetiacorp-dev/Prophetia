/* =========================================================
   PROPHETIA · Addresses Page
   Firestore: users/{uid}/addresses/{addressId}
   Default checkout mirror: users/{uid}/private/defaultAddress
   ========================================================= */

import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const addressPanel = document.querySelector("#addressPanel");
const addressForm = document.querySelector("#addressForm");
const addressList = document.querySelector("[data-address-list]");
const addressEmpty = document.querySelector("[data-address-empty]");
const openButtons = document.querySelectorAll("[data-address-open]");
const closeButtons = document.querySelectorAll("[data-address-close]");

let currentUser = null;
let unsubscribeAddresses = null;
let addressCache = new Map();

function getAddressesRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "addresses");
}

function getDefaultAddressRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "private", "defaultAddress");
}

function openAddressPanel(address = null) {
  if (!addressPanel || !addressForm) return;

  addressForm.reset();

  const title = addressPanel.querySelector("#addressPanelTitle");
  const idInput = addressForm.elements.addressId;

  if (address) {
    if (title) title.textContent = "Editar dirección";

    idInput.value = address.id || "";
    addressForm.elements.alias.value = address.alias || "";
    addressForm.elements.name.value = address.name || "";
    addressForm.elements.phone.value = address.phone || "";
    addressForm.elements.line1.value = address.line1 || "";
    addressForm.elements.city.value = address.city || "";
    addressForm.elements.postcode.value = address.postcode || "";
    addressForm.elements.province.value = address.province || "";
    addressForm.elements.country.value = address.country || "España";
    addressForm.elements.isDefault.checked = !!address.isDefault;
  } else {
    if (title) title.textContent = "Nueva dirección";

    idInput.value = "";
    addressForm.elements.country.value = "España";

    /**
     * Si no hay ninguna dirección guardada, la primera se propone
     * automáticamente como predeterminada.
     */
    addressForm.elements.isDefault.checked = addressCache.size === 0;
  }

  if (typeof addressPanel.showModal === "function") {
    addressPanel.showModal();
  }
}

function closeAddressPanel() {
  if (!addressPanel) return;

  if (typeof addressPanel.close === "function") {
    addressPanel.close();
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function syncDefaultAddressMirror(addressId) {
  if (!currentUser || !addressId) return;

  const addressRef = doc(db, "users", currentUser.uid, "addresses", addressId);
  const snapshot = await getDoc(addressRef);

  if (!snapshot.exists()) return;

  const defaultRef = getDefaultAddressRef();

  await setDoc(defaultRef, {
    addressId,
    ...snapshot.data(),
    syncedAt: serverTimestamp()
  }, { merge: true });
}

async function ensureSingleAddressIsDefault(addresses) {
  if (!currentUser || addresses.length !== 1) return;

  const onlyAddress = addresses[0];

  if (onlyAddress.isDefault) {
    await syncDefaultAddressMirror(onlyAddress.id);
    return;
  }

  const addressRef = doc(db, "users", currentUser.uid, "addresses", onlyAddress.id);

  await updateDoc(addressRef, {
    isDefault: true,
    updatedAt: serverTimestamp()
  });

  await syncDefaultAddressMirror(onlyAddress.id);
}

function renderAddresses(addresses) {
  if (!addressList) return;

  const hasOnlyOne = addresses.length === 1;

  addressCache = new Map(addresses.map((item) => [item.id, item]));

  if (addressEmpty) {
    addressEmpty.hidden = addresses.length > 0;
  }

  addressList.innerHTML = addresses.map((address) => {
    const alias = escapeHtml(address.alias || "Dirección");
    const name = escapeHtml(address.name || "Cliente Prophetia");
    const phone = escapeHtml(address.phone || "Teléfono sin configurar");
    const line1 = escapeHtml(address.line1 || "");
    const city = escapeHtml(address.city || "");
    const postcode = escapeHtml(address.postcode || "");
    const province = escapeHtml(address.province || "");
    const country = escapeHtml(address.country || "España");

    const shouldShowDefaultBadge = address.isDefault || hasOnlyOne;
    const shouldShowDefaultButton = !address.isDefault && !hasOnlyOne;

    return `
      <article class="address-card${shouldShowDefaultBadge ? " is-default" : ""}" data-address-id="${address.id}">
        <div class="address-card__content">
          <span class="address-card__tag">${alias}</span>

          <h3 class="address-card__name">${name}</h3>

          <p class="address-card__text">
            ${phone}<br>
            ${line1}<br>
            ${postcode} ${city}${province ? `, ${province}` : ""}<br>
            ${country}
          </p>

          ${
            shouldShowDefaultBadge
              ? `<span class="address-card__default">Dirección predeterminada</span>`
              : ``
          }

          ${
            shouldShowDefaultButton
              ? `<button class="address-card__set-default" type="button" data-address-default="${address.id}">
                   Usar como predeterminada
                 </button>`
              : ``
          }
        </div>

        <div class="address-card__actions">
          <button type="button" data-address-delete="${address.id}">Borrar</button>
          <button type="button" data-address-edit="${address.id}">Editar</button>
        </div>
      </article>
    `;
  }).join("");
}

async function setDefaultAddress(addressId) {
  const addressesRef = getAddressesRef();
  if (!addressesRef || !addressId) return;

  const snapshot = await getDocs(addressesRef);
  const batch = writeBatch(db);

  snapshot.forEach((item) => {
    const itemRef = doc(db, "users", currentUser.uid, "addresses", item.id);

    batch.update(itemRef, {
      isDefault: item.id === addressId,
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
  await syncDefaultAddressMirror(addressId);
}

function getAddressPayload(formData) {
  return {
    alias: String(formData.get("alias") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    line1: String(formData.get("line1") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    postcode: String(formData.get("postcode") || "").trim(),
    province: String(formData.get("province") || "").trim(),
    country: String(formData.get("country") || "España").trim(),
    isDefault: formData.get("isDefault") === "on",
    updatedAt: serverTimestamp()
  };
}

function validateAddressPayload(payload) {
  return (
    payload.alias &&
    payload.name &&
    payload.phone &&
    payload.line1 &&
    payload.city &&
    payload.postcode
  );
}
async function completeFirstAddressMission() {
  if (!currentUser?.getIdToken) return;

  try {
    const token = await currentUser.getIdToken(true);

    const response = await fetch("/api/tribe/mission/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        missionId: "first-address"
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn("[ADDRESSES] Misión first-address no completada:", data.error || response.status);
      return;
    }

    window.dispatchEvent(new CustomEvent("pp:tribe-mission-completed", {
      detail: data
    }));

    console.info("[ADDRESSES] Misión first-address comprobada:", data);
  } catch (error) {
    console.warn("[ADDRESSES] No se pudo comprobar misión first-address:", error);
  }
}

async function saveAddress(event) {
  event.preventDefault();

  if (!currentUser) {
    alert("Necesitas iniciar sesión para guardar direcciones.");
    return;
  }

  if (!addressForm) return;

  const submitBtn = addressForm.querySelector('button[type="submit"]');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando...";
    }

    const formData = new FormData(addressForm);
    const addressId = String(formData.get("addressId") || "").trim();
    const payload = getAddressPayload(formData);

    /**
     * Primera dirección = predeterminada automáticamente.
     */
    if (!addressId && addressCache.size === 0) {
      payload.isDefault = true;
    }

    if (!validateAddressPayload(payload)) {
      alert("Completa los campos principales de la dirección.");
      return;
    }

let savedAddressId = addressId;
let createdNewAddress = false;

if (addressId) {
  const addressRef = doc(db, "users", currentUser.uid, "addresses", addressId);

  await updateDoc(addressRef, payload);

  if (payload.isDefault || addressCache.size === 1) {
    await setDefaultAddress(addressId);
  }
} else {
  payload.createdAt = serverTimestamp();

  const created = await addDoc(getAddressesRef(), payload);
  savedAddressId = created.id;
  createdNewAddress = true;

  if (payload.isDefault) {
    await setDefaultAddress(created.id);
  }
}

if (createdNewAddress && savedAddressId) {
  await completeFirstAddressMission();
}

closeAddressPanel();
  } catch (error) {
    console.error("[ADDRESSES] Error guardando dirección:", error);

    alert(
      "No se ha podido guardar la dirección. Revisa reglas de Firestore y la consola."
    );
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar dirección";
    }
  }
}

async function deleteAddress(addressId) {
  if (!currentUser || !addressId) return;

  const ok = window.confirm("¿Borrar esta dirección del archivo Prophetia?");
  if (!ok) return;

  const deletedAddress = addressCache.get(addressId);
  const addressRef = doc(db, "users", currentUser.uid, "addresses", addressId);

  await deleteDoc(addressRef);

  /**
   * Si se borra la predeterminada, elegimos otra como predeterminada
   * para no dejar el checkout con un mirror obsoleto.
   */
  if (deletedAddress?.isDefault) {
    const remaining = Array.from(addressCache.values())
      .filter((item) => item.id !== addressId);

    if (remaining.length > 0) {
      await setDefaultAddress(remaining[0].id);
    } else {
      const defaultRef = getDefaultAddressRef();
      if (defaultRef) {
        await setDoc(defaultRef, {
          addressId: "",
          clearedAt: serverTimestamp()
        }, { merge: true });
      }
    }
  }
}

function bindEvents() {
  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => openAddressPanel());
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", closeAddressPanel);
  });

  addressForm?.addEventListener("submit", saveAddress);

  addressList?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-address-edit]");
    const deleteBtn = event.target.closest("[data-address-delete]");
    const defaultBtn = event.target.closest("[data-address-default]");

    if (editBtn) {
      const id = editBtn.dataset.addressEdit;
      const address = addressCache.get(id);

      if (address) openAddressPanel(address);
    }

    if (deleteBtn) {
      await deleteAddress(deleteBtn.dataset.addressDelete);
    }

    if (defaultBtn) {
      await setDefaultAddress(defaultBtn.dataset.addressDefault);
    }
  });
}

function listenAddresses() {
  if (!currentUser) return;

  if (unsubscribeAddresses) {
    unsubscribeAddresses();
  }

  const addressesRef = getAddressesRef();
  const addressesQuery = query(addressesRef, orderBy("createdAt", "desc"));

  unsubscribeAddresses = onSnapshot(addressesQuery, async (snapshot) => {
    const addresses = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderAddresses(addresses);

    try {
      await ensureSingleAddressIsDefault(addresses);
    } catch (error) {
      console.warn("[ADDRESSES] No se pudo auto-marcar predeterminada:", error);
    }
  }, (error) => {
    console.error("[ADDRESSES] Error leyendo direcciones:", error);
  });
}

function showGuestState() {
  const guestBlock = document.querySelector("[data-pp-addresses-guest]");
  const loggedBlock = document.querySelector("[data-pp-addresses-logged]");

if (guestBlock) {
  guestBlock.hidden = false;
  guestBlock.removeAttribute("aria-hidden");
}

if (loggedBlock) {
  loggedBlock.hidden = true;
  loggedBlock.setAttribute("aria-hidden", "true");
}

  document.body.classList.remove("pp-auth-logged");
  document.body.classList.add("pp-auth-guest");

  renderAddresses([]);
}

function showLoggedState() {
  const guestBlock = document.querySelector("[data-pp-addresses-guest]");
  const loggedBlock = document.querySelector("[data-pp-addresses-logged]");

if (guestBlock) {
  guestBlock.hidden = true;
  guestBlock.setAttribute("aria-hidden", "true");
}

if (loggedBlock) {
  loggedBlock.hidden = false;
  loggedBlock.removeAttribute("aria-hidden");
}

  document.body.classList.add("pp-auth-logged");
  document.body.classList.remove("pp-auth-guest");
}

bindEvents();

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  if (!currentUser) {
    if (unsubscribeAddresses) unsubscribeAddresses();

    showGuestState();
    return;
  }

  showLoggedState();
  listenAddresses();
});