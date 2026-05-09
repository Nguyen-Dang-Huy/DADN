import cron from 'node-cron';
import automationService from './AutomationService.js';

class SchedulerService {
  constructor() {
    this.jobs = {};
  }

  /**
   * Khởi tạo tất cả các lịch trình tự động hóa
   */
  initSchedules() {
    console.log('⏰ [Scheduler] Khởi tạo hệ thống đặt lịch tự động hóa...');

    // 1. Lịch Morning Mode: Chạy lúc 5:45 AM mỗi ngày
    this.jobs.morning = cron.schedule('45 5 * * *', () => {
      const state = automationService.getAutomationState();
      // Chỉ chạy nếu người dùng đang bật nút gạt Morning Mode trên UI
      if (state.modes.morning.active) {
        console.log('⏰ [Scheduler] Kích hoạt kịch bản Buổi Sáng');
        automationService.executeMorningMode();
      }
    });

    // 2. Lịch Night Mode: Chạy lúc 22:30 (10:30 PM) mỗi ngày
    this.jobs.night = cron.schedule('30 22 * * *', () => {
      const state = automationService.getAutomationState();
      // Chỉ chạy nếu người dùng đang bật nút gạt Night Mode
      if (state.modes.night.active) {
        console.log('⏰ [Scheduler] Kích hoạt kịch bản Buổi Tối');
        automationService.executeNightMode();
      }
    });

    // 3. (Tùy chọn) Có thể thêm lịch tắt Presence Simulation nếu lỡ người dùng đi vắng quá lâu
    this.jobs.presenceCleanup = cron.schedule('0 23 * * *', () => {
       console.log('⏰ [Scheduler] Dọn dẹp tiến trình chạy ngầm cuối ngày');
       // Logic dọn dẹp thêm nếu cần
    });

    console.log('⏰ [Scheduler] Đã lên lịch thành công!');
  }

  /**
   * Dừng toàn bộ lịch (dùng khi shutdown server)
   */
  stopAll() {
    Object.values(this.jobs).forEach(job => job.stop());
    console.log('⏰ [Scheduler] Đã dừng toàn bộ lịch trình.');
  }
}

export default new SchedulerService();
