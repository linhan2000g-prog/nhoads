const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyZuVRApTrei4s-iKOUjs-fEjsHgoYwGvQrf6kibcfTh_j_R9q3TKVUkPHc326BNSKlZg/exec';
const FIREBASE_URL = 'https://appnguyenhoads-default-rtdb.asia-southeast1.firebasedatabase.app/';

export async function fetchData(module: string, params: Record<string, string | number> = {}) {
  try {
    // 1. Try to fetch from Firebase for blazing fast reads
    if (module !== 'auth' && module !== 'dashboard') {
      try {
        const firebaseSecret = localStorage.getItem('firebase_secret');
        const authParam = firebaseSecret ? `?auth=${firebaseSecret}` : '';
        const fbRes = await fetch(`${FIREBASE_URL}${module}.json${authParam}`);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          
          if (fbData === null) {
            // users module does not sync automatically, so if it's null, we MUST fall back to GAS
            if (module === 'users') {
              throw new Error("Users module not in Firebase, fallback to GAS");
            }
            return { data: [] };
          }
          
          let returnData = null;
          
          if (fbData.data) {
            returnData = fbData;
          } else if (fbData.products || fbData.phaithu) {
            returnData = fbData;
          } else if (Array.isArray(fbData)) {
            returnData = { data: fbData };
          } else if (fbData.error) {
            if (module === 'users') throw new Error("Users module has error, fallback to GAS");
            return { data: [] };
          } else {
            if (module === 'users') throw new Error("Users module missing, fallback to GAS");
            return { data: [] };
          }

          if (returnData) {
            const keysToNormalize = ['data', 'products', 'logs', 'phaithu', 'phaitra'];
            keysToNormalize.forEach(key => {
              if (returnData[key]) {
                let arr = returnData[key];
                if (!Array.isArray(arr)) {
                  arr = Object.values(arr);
                }
                returnData[key] = arr.filter((item: any) => item !== null);
              }
            });

            // Apply filtering for thuchi
            if (module === 'thuchi' && params.month && params.year && returnData.data) {
              const month = Number(params.month);
              const year = Number(params.year);
              returnData.data = returnData.data.filter((row: any) => {
                if (!row || !row.date) return false;
                const d = new Date(row.date);
                return (d.getMonth() + 1 === month) && (d.getFullYear() === year);
              });
            }
            return returnData;
          }
        }
      } catch (fbErr) {
        console.warn("Firebase fetch failed, falling back to Apps Script", fbErr);
      }
    }

    // 2. Fallback to Google Apps Script if Firebase fails or is empty
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('module', module);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text().catch(() => 'no text');
      throw new Error(`Network response was not ok (GET ${module}): ${response.status} ${response.statusText} - ${text.substring(0, 100)}`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    return data;
  } catch (error) {
    console.error(`Error fetching data for module ${module}:`, error);
    throw error;
  }
}

export async function postData(module: string, action: string, data: Record<string, unknown> = {}) {
  try {
    const userStr = localStorage.getItem('erp_user');
    let username = "Unknown";
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        username = userObj.username;
      } catch (e) {}
    }

    const payload = {
      module,
      action,
      user: username,
      secret: localStorage.getItem('app_secret') || '',
      ...data
    };

    // 1. OPTIMISTIC FIREBASE UPDATE for instant UI feedback
    if (module !== 'auth' && module !== 'dashboard' && (action === 'add' || action === 'update' || action === 'delete' || action === 'updateDueDate' || action === 'pay_debt' || action === 'delete_product')) {
      try {
        const firebaseSecret = localStorage.getItem('firebase_secret');
        const authParam = firebaseSecret ? `?auth=${firebaseSecret}` : '';
        const fbRes = await fetch(`${FIREBASE_URL}${module}.json${authParam}`);
        
        if (fbRes.ok) {
          let currentData = await fbRes.json() || {};
          
          let dataArray = [];
          const mainKey = currentData.data ? 'data' : (currentData.products ? 'products' : (currentData.phaithu ? 'phaithu' : null));
          
          if (mainKey) {
              dataArray = currentData[mainKey] || [];
              if (!Array.isArray(dataArray)) dataArray = Object.values(dataArray);
              dataArray = dataArray.filter((item: any) => item !== null);
          } else if (Array.isArray(currentData)) {
              dataArray = currentData;
              currentData = { data: currentData };
          } else {
              currentData = { data: [] };
          }
          
          // Generate an optimistic ID for new items
          const tempId = data.id || `temp_${Date.now()}`;
          const itemData = data.data as any || {};
          
          if (action === 'add') {
            const newItem = { id: tempId, ...itemData };
            dataArray.push(newItem);
          } else if (action === 'update') {
            const idToUpdate = data.id || itemData.id;
            const index = dataArray.findIndex((item: any) => item.id === idToUpdate);
            if (index !== -1) {
              dataArray[index] = { ...dataArray[index], ...itemData };
            }
          } else if (action === 'updateDueDate') {
            const idToUpdate = data.id || itemData.id;
            const index = dataArray.findIndex((item: any) => item.id === idToUpdate);
            if (index !== -1) {
              dataArray[index].dueDate = data.newDueDate || itemData.newDueDate;
            }
          } else if (action === 'pay_debt') {
            const idToUpdate = data.id || itemData.id;
            const type = data.type || itemData.type;
            const amount = Number(data.amount || itemData.amount) || 0;
            // For congno, handle both phaithu and phaitra
            if (module === 'congno') {
              const arrayKey = type === 'tra' ? 'phaitra' : 'phaithu';
              const targetArray = currentData[arrayKey] || [];
              const index = targetArray.findIndex((item: any) => item.id === idToUpdate);
              if (index !== -1) {
                const currentDebt = Number(targetArray[index].debt) || 0;
                const newDebt = Math.max(0, currentDebt - amount);
                if (newDebt <= 0) {
                  targetArray.splice(index, 1);
                } else {
                  targetArray[index].debt = newDebt;
                }
                currentData[arrayKey] = targetArray;
              }
            } else {
              const index = dataArray.findIndex((item: any) => item.id === idToUpdate);
              if (index !== -1) {
                const currentDebt = Number(dataArray[index].debt) || 0;
                const newDebt = Math.max(0, currentDebt - amount);
                if (newDebt <= 0) {
                  dataArray.splice(index, 1);
                } else {
                  dataArray[index].debt = newDebt;
                }
              }
            }
          } else if (action === 'delete' || action === 'delete_product') {
            const idToDelete = data.id;
            dataArray = dataArray.filter((item: any) => item.id !== idToDelete);
          }
          
          if (mainKey) {
             currentData[mainKey] = dataArray;
          } else {
             currentData.data = dataArray;
          }
          
          // Write back to Firebase instantly
          await fetch(`${FIREBASE_URL}${module}.json${authParam}`, {
            method: 'PUT',
            body: JSON.stringify(currentData)
          });
        }
      } catch (e) {
        console.warn('Optimistic Firebase update failed', e);
      }
    }

    // 2. SYNC TO GOOGLE APPS SCRIPT
    // We must await for the real response because GAS handles cross-module side-effects 
    // (e.g. nhapkho updates khohang and congno). If we don't await, the UI will reload 
    // old data from Firebase before GAS finishes syncing.
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => 'no text');
      throw new Error(`Network response was not ok (POST ${module}): ${response.status} ${response.statusText} - ${text.substring(0, 100)}`);
    }
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result as any;
    
  } catch (error) {
    console.error(`Error preparing data for module ${module}, action ${action}:`, error);
    throw error;
  }
}
