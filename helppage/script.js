let currentExpandedSections = new Set(); 
let kindergartenSectionsRendered = false;
let elementarySectionsRendered = false;
let secondarySectionsRendered = false;
let specialSectionsRendered = false;
let adminSectionsRendered = false;
let staffSectionsRendered = false;

function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow = document.getElementById(`${sectionId}-arrow`);

    if (!content.classList.contains('open')) {
        content.classList.add('open');
        if (arrow) arrow.style.transform = 'rotate(180deg)';

        const button = arrow ? arrow.closest('button') : document.querySelector(`button[onclick="toggleSection('${sectionId}')"]`);
        if (button) {
            button.classList.remove('rounded-lg');
            button.classList.add('rounded-t-lg');
        }
        
        if (sectionId === 'kindergarten' && !kindergartenSectionsRendered) {
            renderKindergartenSections();
            kindergartenSectionsRendered = true;
        } else if (sectionId === 'elementary' && !elementarySectionsRendered) {
            renderElementarySections();
            elementarySectionsRendered = true;
        } else if (sectionId === 'secondary' && !secondarySectionsRendered) {
            renderSecondarySections();
            secondarySectionsRendered = true;
        } else if (sectionId === 'special' && !specialSectionsRendered) {
            renderSpecialSections();
            specialSectionsRendered = true;
        } else if (sectionId === 'admin' && !adminSectionsRendered) {
            renderAdminSections();
            adminSectionsRendered = true;
        } else if (sectionId === 'staff' && !staffSectionsRendered) {
            renderStaffSections();
            staffSectionsRendered = true;
        } else {
            replaySubSectionAnimations(sectionId);
        }

    } else {
        content.classList.remove('open');
        if (arrow) arrow.style.transform = 'rotate(0deg)';

        const button = arrow ? arrow.closest('button') : document.querySelector(`button[onclick="toggleSection('${sectionId}')"]`);
        if (button) {
            button.classList.remove('rounded-t-lg');
            button.classList.add('rounded-lg');
        }
    }
}

function renderKindergartenSections() {
    const container = document.getElementById('kindergarten-sections');
    container.innerHTML = '';
    Object.entries(kindergartenData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'kindergarten', 'toggleKindergartenSubSection', index);
        container.appendChild(sectionElement);
    });
}

function renderElementarySections() {
    const container = document.getElementById('elementary-sections');
    container.innerHTML = '';
    Object.entries(elementaryData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'elementary', 'toggleElementarySubSection', index);
        container.appendChild(sectionElement);
    });
}

function renderSecondarySections() {
    const container = document.getElementById('secondary-sections');
    container.innerHTML = '';
    Object.entries(secondaryData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'secondary', 'toggleSecondarySubSection', index);
        container.appendChild(sectionElement);
    });
}

function renderSpecialSections() {
    const container = document.getElementById('special-sections');
    container.innerHTML = '';
    Object.entries(specialData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'special', 'toggleSpecialSubSection', index);
        container.appendChild(sectionElement);
    });
}

function renderAdminSections() {
    const container = document.getElementById('admin-sections');
    container.innerHTML = '';
    Object.entries(adminData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'admin', 'toggleAdminSubSection', index);
        container.appendChild(sectionElement);
    });
}

function renderStaffSections() {
    const container = document.getElementById('staff-sections');
    container.innerHTML = '';
    Object.entries(staffData).forEach(([sectionTitle, sectionData], index) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, 'staff', 'toggleStaffSubSection', index);
        container.appendChild(sectionElement);
    });
}


function createDetailedSectionHTML(title, data, typePrefix, toggleFunctionName, index = 0) {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'mb-4 border border-gray-200 rounded-lg overflow-hidden shadow-xs card-entrance';
    sectionElement.style.animationDelay = `${index * 60}ms`;
    
    const sectionId = `${typePrefix}-section-${title.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')}`.replace(/\\./g, '-');
    
    sectionElement.innerHTML = `
        <button 
            onclick="${toggleFunctionName}('${sectionId}')" 
            class="w-full p-4 text-left flex items-center justify-between hover:bg-gray-100 transition-colors duration-200 bg-white"
        >
            <div class="flex items-center">
                <div class="w-8 h-8 bg-${data.color}-100 rounded-md flex items-center justify-center mr-3">
                    <i class="${data.icon} text-${data.color}-600 text-sm\"></i>
                </div>
                <span class="font-medium text-gray-800">${title}</span>
            </div>
            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-200" id="${sectionId}-arrow"></i>
        </button>
        
        <div id="${sectionId}-content" class="slide-content">
            <div>
                <div class="bg-gray-50 border-t border-gray-200">
                    ${data.items.map(item => `
                        <div class="px-4 py-2 border-b border-gray-100 last:border-b-0">
                            <a
                                href="${item.url}"
                                target="_blank"
                                class="flex items-center text-gray-700 hover:text-${data.color}-600 hover:bg-white p-2 rounded-md transition-all duration-200 group"
                            >
                                <i class="fas fa-file-alt text-gray-400 group-hover:text-${data.color}-500 mr-3 text-sm"></i>
                                <span class="text-sm flex-grow">${item.title}</span>
                                <i class="fas fa-external-link-alt text-gray-300 group-hover:text-${data.color}-400 ml-2 text-xs flex-shrink-0"></i>
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    return sectionElement;
}

function toggleKindergartenSubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}

function toggleElementarySubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}

function toggleSecondarySubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}

function toggleSpecialSubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}

function toggleAdminSubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}

function toggleStaffSubSection(sectionId) {
    toggleDetailedSubSection(sectionId);
}


function toggleDetailedSubSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow = document.getElementById(`${sectionId}-arrow`);

    if (!content.classList.contains('open')) {
        content.classList.add('open');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        content.classList.remove('open');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

function searchKindergarten() {
    const searchTerm = document.getElementById('kindergarten-search').value.toLowerCase();
    const container = document.getElementById('kindergarten-sections');
    searchDetailedItems(searchTerm, kindergartenData, container, 'kindergarten', 'toggleKindergartenSubSection');
}

function searchElementary() {
    const searchTerm = document.getElementById('elementary-search').value.toLowerCase();
    const container = document.getElementById('elementary-sections');
    searchDetailedItems(searchTerm, elementaryData, container, 'elementary', 'toggleElementarySubSection');
}

function searchSecondary() {
    const searchTerm = document.getElementById('secondary-search').value.toLowerCase();
    const container = document.getElementById('secondary-sections');
    searchDetailedItems(searchTerm, secondaryData, container, 'secondary', 'toggleSecondarySubSection');
}

function searchSpecial() {
    const searchTerm = document.getElementById('special-search').value.toLowerCase();
    const container = document.getElementById('special-sections');
    searchDetailedItems(searchTerm, specialData, container, 'special', 'toggleSpecialSubSection');
}

function searchAdmin() {
    const searchTerm = document.getElementById('admin-search').value.toLowerCase();
    const container = document.getElementById('admin-sections');
    searchDetailedItems(searchTerm, adminData, container, 'admin', 'toggleAdminSubSection');
}

function searchStaff() {
    const searchTerm = document.getElementById('staff-search').value.toLowerCase();
    const container = document.getElementById('staff-sections');
    searchDetailedItems(searchTerm, staffData, container, 'staff', 'toggleStaffSubSection');
}


function searchDetailedItems(searchTerm, dataObject, containerElement, typePrefix, toggleFunctionName) {
    if (!searchTerm.trim()) {
        containerElement.innerHTML = ''; 
         Object.entries(dataObject).forEach(([sectionTitle, sectionData]) => {
            const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, typePrefix, toggleFunctionName);
            containerElement.appendChild(sectionElement);
        });
        setTimeout(() => {
            Object.keys(dataObject).forEach(sectionTitle => {
                const sectionId = `${typePrefix}-section-${sectionTitle.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')}`.replace(/\\./g, '-');
                const content = document.getElementById(`${sectionId}-content`);
                const arrow = document.getElementById(`${sectionId}-arrow`);
                if (content && content.classList.contains('open')) {
                    content.classList.remove('open');
                    if(arrow) arrow.style.transform = 'rotate(0deg)';
                }
            });
        }, 0); 
        return;
    }
    
    const filteredData = {};
    Object.entries(dataObject).forEach(([sectionTitle, sectionData]) => {
        const matchingItems = sectionData.items.filter(item => 
            item.title.toLowerCase().includes(searchTerm) ||
            sectionTitle.toLowerCase().includes(searchTerm)
        );
        
        if (matchingItems.length > 0 || sectionTitle.toLowerCase().includes(searchTerm)) {
            filteredData[sectionTitle] = {
                ...sectionData,
                items: sectionTitle.toLowerCase().includes(searchTerm) && matchingItems.length === 0 ? sectionData.items : matchingItems
            };
        }
    });
    
    containerElement.innerHTML = '';
    if (Object.keys(filteredData).length === 0) {
        containerElement.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-search text-2xl mb-2\\"></i>
                <p>검색 결과가 없습니다.</p>
            </div>
        `;
        return;
    }
    
    Object.entries(filteredData).forEach(([sectionTitle, sectionData]) => {
        const sectionElement = createDetailedSectionHTML(sectionTitle, sectionData, typePrefix, toggleFunctionName);
        containerElement.appendChild(sectionElement);
        
        const sectionId = `${typePrefix}-section-${sectionTitle.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')}`.replace(/\\./g, '-');
        const sectionTitleMatches = sectionTitle.toLowerCase().includes(searchTerm);
        const itemsMatch = sectionData.items.some(item => item.title.toLowerCase().includes(searchTerm));

        if (sectionTitleMatches || itemsMatch) {
             setTimeout(() => { 
                const content = document.getElementById(`${sectionId}-content`);
                const arrow = document.getElementById(`${sectionId}-arrow`);
                if (content && arrow) {
                    content.classList.add('open');
                    arrow.style.transform = 'rotate(180deg)';
                }
            }, 50); 
        }
    });
}

function replaySubSectionAnimations(sectionId) {
    const container = document.getElementById(`${sectionId}-sections`);
    if (!container) return;
    const items = container.querySelectorAll('.card-entrance');
    items.forEach((el, i) => {
        el.classList.remove('card-entrance');
        void el.offsetWidth;
        el.style.animationDelay = `${i * 60}ms`;
        el.classList.add('card-entrance');
    });
}

document.addEventListener('DOMContentLoaded', function() {
});
