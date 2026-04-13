
/**
 * School Meal Information Service
 * Target: 횡천초등학교 (Hoengcheon Elementary School)
 * ATPT_OFCDC_SC_CODE: S10
 * SD_SCHUL_CODE: 9181023
 */

(function() {
    // API Configurations
    const API_KEY = '0131b45eced14b9e9732e7ebc53ae682'; // Security: In production, use environment variables or a proxy.
    const OFFICE_CODE = 'S10';
    const SCHOOL_CODE = '9181023'; // Updated with user's administrative standard code
    const BASE_URL = 'https://open.neis.go.kr/hub/mealServiceDietInfo';


    const mealState = {
        view: 'weekly', // 'weekly' or 'monthly'
        weekOffset: 0,
        monthOffset: 0
    };

    /**
     * Fetch meal data for a specific date range
     */
    async function fetchMealData(startDate, endDate) {
        try {
            const url = `${BASE_URL}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.mealServiceDietInfo) {
                return data.mealServiceDietInfo[1].row;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch meal data:', error);
            return [];
        }
    }

    /**
     * Format menu string: remove brackets, numbers and split by br
     */
    function formatMenu(menuStr) {
        if (!menuStr) return '급식 정보가 없습니다.';
        return menuStr
            .replace(/\([^)]*\)/g, '')   // Remove allergy info
            .split('<br/>')              // Split by br
            .map(item => item.trim())    // Trim
            .filter(i => i)              // Filter empty
            .join(', ')                  // Join by comma
            .replace(/\.{2,}/g, '.')     // Remove multi dots
            .replace(/\s+/g, ' ');       // Remove multi space
    }

    /**
     * Update Today's Meal Widget (Sidebar)
     */
    async function updateTodayWidget() {
        const today = new Date();
        const ymd = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
        
        const meals = await fetchMealData(ymd, ymd);
        const widgetContainer = document.getElementById('today-widget-header');
        
        if (!widgetContainer) return;

        const existing = widgetContainer.querySelector('.widget-meal-info');
        if (existing) existing.remove();

        const meal = meals.find(m => m.MMEAL_SC_CODE === '2') || (meals.length > 0 ? meals[0] : null);
        const mealInfoDiv = document.createElement('div');
        mealInfoDiv.className = 'widget-meal-info';
        
        if (meal) {
            const menu = formatMenu(meal.DDISH_NM);
            mealInfoDiv.innerHTML = `<strong>🍴 오늘의 급식 <a class="meal-more-btn" onclick="window.switchTab('meal')">더보기</a></strong>${menu}`;
        } else {
            mealInfoDiv.innerHTML = `<strong>🍴 오늘의 급식 <a class="meal-more-btn" onclick="window.switchTab('meal')">더보기</a></strong>정보가 없습니다.`;
        }
        
        widgetContainer.parentNode.insertBefore(mealInfoDiv, widgetContainer.nextSibling);
    }

    /**
     * Change viewed period
     */
    window.changeMealPeriod = function(offset) {
        if (mealState.view === 'weekly') {
            mealState.weekOffset += offset;
            renderWeeklyView();
        } else {
            mealState.monthOffset += offset;
            renderMonthlyView();
        }
    };

    /**
     * Switch View (Weekly / Monthly)
     */
    window.setMealView = function(view) {
        mealState.view = view;
        
        // Update button UI
        document.getElementById('view-weekly-btn').classList.toggle('active', view === 'weekly');
        document.getElementById('view-monthly-btn').classList.toggle('active', view === 'monthly');
        
        if (view === 'weekly') {
            renderWeeklyView();
        } else {
            renderMonthlyView();
        }
    };

    /**
     * Render Weekly Meal Section
     */
    async function renderWeeklyView() {
        const container = document.getElementById('meal-list-container');
        const rangeText = document.getElementById('meal-range-text');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">급식 정보를 불러오는 중...</div>';
        
        const now = new Date();
        now.setDate(now.getDate() + (mealState.weekOffset * 7));
        
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(now); 
        monday.setDate(diff);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        if (rangeText) {
            rangeText.innerHTML = `${monday.getMonth()+1}/${monday.getDate()} ~ ${sunday.getMonth()+1}/${sunday.getDate()} <i class="fas fa-calendar-alt"></i>`;
        }

        const startYmd = monday.getFullYear() + String(monday.getMonth() + 1).padStart(2, '0') + String(monday.getDate()).padStart(2, '0');
        const endYmd = sunday.getFullYear() + String(sunday.getMonth() + 1).padStart(2, '0') + String(sunday.getDate()).padStart(2, '0');

        const meals = await fetchMealData(startYmd, endYmd);
        
        let html = '<div class="weekly-meal-grid fade-in">';
        const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일'];
        for(let i=0; i<5; i++) {
            const currentDay = new Date(monday);
            currentDay.setDate(monday.getDate() + i);
            const currentYmd = currentDay.getFullYear() + String(currentDay.getMonth() + 1).padStart(2, '0') + String(currentDay.getDate()).padStart(2, '0');
            const meal = meals.find(m => m.MLSV_YMD === currentYmd && m.MMEAL_SC_CODE === '2') || meals.find(m => m.MLSV_YMD === currentYmd);
            const menu = meal ? formatMenu(meal.DDISH_NM) : '급식 정보가 없습니다.';
            
            // Check if it's today
            const today = new Date();
            const isToday = currentDay.getDate() === today.getDate() && 
                            currentDay.getMonth() === today.getMonth() && 
                            currentDay.getFullYear() === today.getFullYear();
            
            const todayBadge = isToday ? '<span class="today-badge">오늘</span>' : '';
            const todayCircleClass = isToday ? 'today-circle' : '';

            html += `
                <div class="meal-card-horizontal ${isToday ? 'is-today' : ''}">
                    <div class="meal-date-info">
                        ${isToday ? `
                            <div class="today-badge-wrapper">
                                <span class="today-badge">오늘</span>
                            </div>
                        ` : ''}
                        <div class="day ${todayCircleClass}">${currentDay.getDate()}</div>
                        <div class="day-name">${dayNames[i]}</div>
                    </div>
                    <div class="meal-menu-content">
                        ${menu}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Render Monthly Meal Calendar
     */
    async function renderMonthlyView() {
        const container = document.getElementById('meal-list-container');
        const rangeText = document.getElementById('meal-range-text');
        if (!container) return;

        container.innerHTML = '<div class="loading">월간 급식 정보를 불러오는 중...</div>';

        const now = new Date();
        now.setDate(1); 
        now.setMonth(now.getMonth() + mealState.monthOffset);
        
        const year = now.getFullYear();
        const month = now.getMonth();
        
        if (rangeText) {
            rangeText.innerHTML = `${month + 1}월 <i class="fas fa-calendar-alt"></i>`;
        }

        const firstDate = new Date(year, month, 1);
        const lastDate = new Date(year, month + 1, 0);
        
        const startYmd = year + String(month + 1).padStart(2, '0') + '01';
        const endYmd = year + String(month + 1).padStart(2, '0') + String(lastDate.getDate()).padStart(2, '0');

        const meals = await fetchMealData(startYmd, endYmd);

        // Adjust calendar grid to 5 columns in CSS
        container.classList.add('five-cols');
        
        let html = '<div class="monthly-meal-calendar fade-in five-cols">';
        
        // Days of week header (Mon-Fri)
        const dayHeaders = ['월', '화', '수', '목', '금'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });

        // Loop by weeks
        let current = new Date(firstDate);
        // Move to the Monday of the week containing firstDate
        let day = current.getDay();
        let diff = current.getDate() - day + (day === 0 ? -6 : 1);
        current.setDate(diff);

        // Generate cells row by row
        while (current <= lastDate) {
            let weekHtml = '';
            let hasDateInMonth = false;
            
            for (let i = 0; i < 5; i++) { // Mon to Fri
                const d = new Date(current);
                d.setDate(current.getDate() + i);
                
                const isCurrentMonth = (d.getMonth() === month && d.getFullYear() === year);
                if (isCurrentMonth) hasDateInMonth = true;

                if (isCurrentMonth) {
                    const currentYmd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
                    const meal = meals.find(m => m.MLSV_YMD === currentYmd && m.MMEAL_SC_CODE === '2') || meals.find(m => m.MLSV_YMD === currentYmd);
                    const menu = meal ? formatMenu(meal.DDISH_NM) : '';
                    
                    // Check if it's today
                    const now = new Date();
                    const isToday = d.getDate() === now.getDate() && 
                                    d.getMonth() === now.getMonth() && 
                                    d.getFullYear() === now.getFullYear();
                    
                    const todayBadge = isToday ? '<span class="today-badge">오늘</span>' : '';
                    const todayCircleClass = isToday ? 'today-circle' : '';

                    weekHtml += `
                        <div class="calendar-day-cell ${isToday ? 'is-today' : ''}">
                            <div class="day-num-wrapper">
                                ${isToday ? `
                                    <div class="today-badge-wrapper">
                                        <span class="today-badge">오늘</span>
                                    </div>
                                ` : ''}
                                <span class="day-num ${todayCircleClass}">${d.getDate()}</span>
                            </div>
                            <div class="meal-items">${menu}</div>
                        </div>
                    `;
                } else {
                    weekHtml += '<div class="calendar-day-cell empty"></div>';
                }
            }
            
            // Only add the row if at least one day in Mon-Fri belongs to this month
            if (hasDateInMonth) {
                html += weekHtml;
            }
            
            // Move to next week Monday
            current.setDate(current.getDate() + 7);
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Public function to refresh current view
     */
    window.renderMealView = function() {
        if (mealState.view === 'weekly') {
            renderWeeklyView();
        } else {
            renderMonthlyView();
        }
    };

    // Expose functions to window
    window.renderWeeklyView = renderWeeklyView;
    window.renderMonthlyView = renderMonthlyView;
    window.updateTodayWidget = updateTodayWidget;

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        updateTodayWidget();
        
        const mealNavBtn = document.querySelector('.nav-item[data-category="meal"]');
        if (mealNavBtn) {
            mealNavBtn.addEventListener('click', () => {
                window.switchTab('meal');
                window.renderMealView();
            });
        }

        // View switcher listeners
        const weeklyBtn = document.getElementById('view-weekly-btn');
        const monthlyBtn = document.getElementById('view-monthly-btn');
        if (weeklyBtn) weeklyBtn.addEventListener('click', () => window.setMealView('weekly'));
        if (monthlyBtn) monthlyBtn.addEventListener('click', () => window.setMealView('monthly'));
        
        // Initial render for section
        window.renderMealView();
    });

})();
