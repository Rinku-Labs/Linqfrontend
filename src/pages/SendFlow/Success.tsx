import TransactionReceipt from '../../components/TransactionReceipt';
import Header from '../../components/Layout/Header';

export default function Success() {
    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <div className="animate-bounceIn" style={{ flex: 1 }}>
                <TransactionReceipt />
            </div>
        </div>
    );
}
