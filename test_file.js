// File di test per CTIR - funzione con bug intenzionale
function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        // Bug intenzionale: non controlla se item.price esiste
        total += items[i].price;
    }
    return total;
}

// Chiamata di test che causerà un errore
const testItems = [
    { name: 'item1', price: 10 },
    { name: 'item2' }, // manca price - errore!
    { name: 'item3', price: 30 }
];

console.log('Total:', calculateTotal(testItems));
